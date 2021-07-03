## Project setup

Before you run project:
1. create `.env` file in root dir
2. Add your binance api key and optionally set config values:

```
  APIKEY=YOUR_API_KEY
  APISECRET=YOUR_SECRET_KEY
  SINGLE_TRADE_USD_AMOUNT=50
  MAX_OPEN_TRADES=20
  VIRTUAL_TRADES=1
```

## Run project

`yarn start` - run in node

`yarn dev` - run using nodemon with file watch + inspector attached