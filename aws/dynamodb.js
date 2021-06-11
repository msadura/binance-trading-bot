const { DynamoDB } = require('@aws-sdk/client-dynamodb');

(async () => {
  const client = new DynamoDB({
    region: 'us-west-2',
    credentials: {
      accessKeyId: process.env.AWS_KEY,
      secretAccessKey: process.env.AWS_SECRET
    }
  });
  try {
    const results = await client.listTables({});
    console.log(results.TableNames.join('\n'));
  } catch (err) {
    console.error(err);
  }
})();
