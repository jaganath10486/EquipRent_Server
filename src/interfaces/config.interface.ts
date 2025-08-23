export interface Config {
  PORT: number;
  NODE_ENV: string;
  MONGODB_URL: string;
}

export interface MongoDBConfig {
  url: string;
  // options: {
  //   useNewUrlParser: boolean;
  //   useUnifiedTopology: boolean;
  //   useFindAndModify: boolean;
  // };
}
