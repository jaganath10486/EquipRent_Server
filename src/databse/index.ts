import { MongoClient, Db } from "mongodb";
import { MongoDbAccessConfig } from "@configs/environment";

class MongoClientProvider {
  private static client: MongoClient | null = null;
  private static db: Db | null = null;

  public static async connect(): Promise<void> {
    if (!MongoClientProvider.client) {
      try {
        MongoClientProvider.client = new MongoClient(MongoDbAccessConfig.url);
        await MongoClientProvider.client.connect();
        // MongoDB.db = MongoDB.client.db(MongoDbAccessConfig.DB_NAME);
        console.log("✅ MongoDB connected");
      } catch (error) {
        console.error("❌ MongoDB connection failed:", error);
        process.exit(1);
      }
    }
  }

  public static getDb(): Db {
    if (!MongoClientProvider.db) {
      throw new Error("MongoDB not connected. Call MongoDB.connect() first.");
    }
    return MongoClientProvider.db;
  }

  public static async disconnect(): Promise<void> {
    if (MongoClientProvider.client) {
      await MongoClientProvider.client.close();
      MongoClientProvider.client = null;
      MongoClientProvider.db = null;
      console.log("🛑 MongoDB disconnected");
    }
  }
}

export default MongoClientProvider;
