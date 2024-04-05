import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as TelegramBot from 'node-telegram-bot-api';
import OpenAI from 'openai';

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private openai: OpenAI;
  private assistantId: string;
  private openaiThreads: Record<number, string> = {}; // Mapping between chatId and threadId.
  private chatIdTyping: Map<number, number> = new Map(); // Track the 'typing' status to avoid spamming.

  constructor(private readonly configService: ConfigService) {
    const telegramToken = this.configService.get<string>('telegram.token');
    this.bot = new TelegramBot(telegramToken, { polling: true });

    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('openai.apiKey'),
    });

    this.assistantId = this.configService.get<string>('openai.assistantId');

    this.initBot();
  }

  private async initBot() {
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      switch (text) {
        case '/start':
          this.sendWelcomeMessage(chatId, msg.chat.username);
          break;
        case '/new':
          await this.handleNewCommand(chatId);
          break;
        default:
          await this.handleUserMessage(chatId, text);
      }
    });
  }

  private sendWelcomeMessage(chatId: number, username?: string) {
    const welcomeMessage = `Hello @${username}!\nЯ создан чтобы генерировать ответы на переживания и впоросы людей. По поводу гэмблинга. Просто перешлите мне сообщение и я попробую помочь вам в ответе.`;
    this.bot.sendMessage(chatId, welcomeMessage);
  }

  private async handleNewCommand(chatId: number) {
    await this.createThread(chatId);
    await this.sendMessageToOpenAI(chatId, "Let's start a new conversation.");
    this.receiveResponseFromOpenAI(chatId);
  }

  private async handleUserMessage(chatId: number, text: string) {
    await this.sendMessageToOpenAI(chatId, text);
    this.receiveResponseFromOpenAI(chatId);
  }

  private async createThread(chatId: number) {
    const thread = await this.openai.beta.threads.create(); // Simplified API usage.
    this.openaiThreads[chatId] = thread.id;
  }

  private async sendMessageToOpenAI(chatId: number, text: string) {
    if (!this.openaiThreads[chatId]) {
      await this.createThread(chatId); // Ensure a thread exists for the chat.
    }

    await this.openai.beta.threads.messages.create(this.openaiThreads[chatId], {
      role: 'user',
      content: text,
    });
  }

  private receiveResponseFromOpenAI(chatId: number) {
    this.openai.beta.threads.runs
      .createAndStream(this.openaiThreads[chatId], {
        assistant_id: this.assistantId,
      })
      .on('textDone', (textDone) => {
        this.bot.sendMessage(chatId, textDone.value); // Directly send the received message.
      });
  }

  sendTypingForChat(chatId: number) {
    const now = new Date().getTime();

    if (
      !this.chatIdTyping.has(chatId) ||
      this.chatIdTyping.get(chatId) + 5000 < now
    ) {
      this.chatIdTyping.set(chatId, now);
      this.bot.sendChatAction(chatId, 'typing');
    }
  }
}
