import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Organizations table
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  plan: text("plan").notNull().default("free"), // free, pro, enterprise
  apiQuota: integer("api_quota").notNull().default(1000),
  apiUsed: integer("api_used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  role: text("role").notNull().default("member"), // owner, admin, member
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Agents table
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // web_scraper, form_filler, data_monitor, social_media, custom
  targetWebsite: text("target_website"),
  instructions: text("instructions").notNull(),
  schedule: text("schedule").notNull().default("manual"), // manual, 15min, hourly, daily, weekly
  priority: text("priority").notNull().default("normal"), // low, normal, high, critical
  status: text("status").notNull().default("inactive"), // active, inactive, paused, error
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  config: jsonb("config"), // Agent-specific configuration
  lastRun: timestamp("last_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task Executions table
export const taskExecutions = pgTable("task_executions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  logs: jsonb("logs"), // Execution logs and screenshots
  result: jsonb("result"), // Task results
  error: text("error"), // Error message if failed
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
});

// Usage tracking table
export const usageTracking = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").references(() => organizations.id).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  apiCalls: integer("api_calls").notNull().default(0),
  browserSessions: integer("browser_sessions").notNull().default(0),
  storageUsed: integer("storage_used").notNull().default(0), // in MB
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  agents: many(agents),
  taskExecutions: many(taskExecutions),
  usageTracking: many(usageTracking),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  agents: many(agents),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [agents.organizationId],
    references: [organizations.id],
  }),
  createdByUser: one(users, {
    fields: [agents.createdBy],
    references: [users.id],
  }),
  taskExecutions: many(taskExecutions),
}));

export const taskExecutionsRelations = relations(taskExecutions, ({ one }) => ({
  agent: one(agents, {
    fields: [taskExecutions.agentId],
    references: [agents.id],
  }),
  organization: one(organizations, {
    fields: [taskExecutions.organizationId],
    references: [organizations.id],
  }),
}));

export const usageTrackingRelations = relations(usageTracking, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageTracking.organizationId],
    references: [organizations.id],
  }),
}));

// Insert schemas
export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  lastRun: true,
});

export const insertTaskExecutionSchema = createInsertSchema(taskExecutions).omit({
  id: true,
  startTime: true,
  endTime: true,
});

export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({
  id: true,
  date: true,
});

// Types
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type TaskExecution = typeof taskExecutions.$inferSelect;
export type InsertTaskExecution = z.infer<typeof insertTaskExecutionSchema>;

export type UsageTracking = typeof usageTracking.$inferSelect;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
