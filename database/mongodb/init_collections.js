/**
 * MongoDB initialization script for FxZone collections and indexes.
 */

db = db.getSiblingDB('fxzone');

// 1. News Articles Collection
db.createCollection('news_articles');
db.news_articles.createIndex({ "article_id": 1 }, { unique: true });
db.news_articles.createIndex({ "published_at": -1 });
db.news_articles.createIndex({ "category": 1 });
db.news_articles.createIndex({ "asset_tags": 1 });
db.news_articles.createIndex({ "title": "text", "content": "text" }); // Text index for searches

// 2. AI Conversations Collection (Chat history)
db.createCollection('ai_conversations');
db.ai_conversations.createIndex({ "conversation_id": 1, "user_id": 1 }, { unique: true });
db.ai_conversations.createIndex({ "updated_at": -1 });

// 3. AI Insights Collection (Analysis snapshots)
db.createCollection('ai_insights');
db.ai_insights.createIndex({ "symbol": 1 });
db.ai_insights.createIndex({ "user_id": 1 });
db.ai_insights.createIndex({ "created_at": -1 });

// 4. Live Session Summaries Collection
db.createCollection('session_summaries');
db.session_summaries.createIndex({ "session_id": 1 }, { unique: true });
db.session_summaries.createIndex({ "created_at": -1 });

print("MongoDB: FxZone indexes and collections initialized successfully.");
