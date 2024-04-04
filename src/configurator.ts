export const configurator = () => ({
  telegram: {
    token: process.env.TELEGRAM_TOKEN,
  },
  openai: {
    apiKey: process.env.OPENAI_APIKEY,
    assistantId: process.env.OPENAI_ASSISTANT_ID,
  },
});
