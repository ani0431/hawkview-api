export default () => ({
  app: {
    name: 'HawkView',
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
});
