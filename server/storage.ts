import { 
  users, organizations, agents, taskExecutions, usageTracking,
  type User, type InsertUser, type Organization, type InsertOrganization,
  type Agent, type InsertAgent, type TaskExecution, type InsertTaskExecution,
  type UsageTracking, type InsertUsageTracking
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Organization methods
  getOrganization(id: number): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganizationUsage(id: number, apiUsed: number): Promise<void>;
  
  // Agent methods
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentsByOrganization(organizationId: number): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, updates: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<boolean>;
  
  // Task execution methods
  getTaskExecution(id: number): Promise<TaskExecution | undefined>;
  getTaskExecutionsByAgent(agentId: number, limit?: number): Promise<TaskExecution[]>;
  getTaskExecutionsByOrganization(organizationId: number, limit?: number): Promise<TaskExecution[]>;
  createTaskExecution(execution: InsertTaskExecution): Promise<TaskExecution>;
  updateTaskExecution(id: number, updates: Partial<TaskExecution>): Promise<TaskExecution | undefined>;
  
  // Usage tracking methods
  getUsageByOrganization(organizationId: number, date?: Date): Promise<UsageTracking | undefined>;
  createOrUpdateUsage(usage: InsertUsageTracking): Promise<UsageTracking>;
  
  // Session store
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Organization methods
  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return org || undefined;
  }

  async createOrganization(insertOrg: InsertOrganization): Promise<Organization> {
    const [org] = await db
      .insert(organizations)
      .values(insertOrg)
      .returning();
    return org;
  }

  async updateOrganizationUsage(id: number, apiUsed: number): Promise<void> {
    await db
      .update(organizations)
      .set({ apiUsed })
      .where(eq(organizations.id, id));
  }

  // Agent methods
  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent || undefined;
  }

  async getAgentsByOrganization(organizationId: number): Promise<Agent[]> {
    return await db
      .select()
      .from(agents)
      .where(eq(agents.organizationId, organizationId))
      .orderBy(desc(agents.createdAt));
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const [agent] = await db
      .insert(agents)
      .values(insertAgent)
      .returning();
    return agent;
  }

  async updateAgent(id: number, updates: Partial<Agent>): Promise<Agent | undefined> {
    const [agent] = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, id))
      .returning();
    return agent || undefined;
  }

  async deleteAgent(id: number): Promise<boolean> {
    const result = await db.delete(agents).where(eq(agents.id, id));
    return result.rowCount > 0;
  }

  // Task execution methods
  async getTaskExecution(id: number): Promise<TaskExecution | undefined> {
    const [execution] = await db.select().from(taskExecutions).where(eq(taskExecutions.id, id));
    return execution || undefined;
  }

  async getTaskExecutionsByAgent(agentId: number, limit = 50): Promise<TaskExecution[]> {
    return await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.agentId, agentId))
      .orderBy(desc(taskExecutions.startTime))
      .limit(limit);
  }

  async getTaskExecutionsByOrganization(organizationId: number, limit = 50): Promise<TaskExecution[]> {
    return await db
      .select()
      .from(taskExecutions)
      .where(eq(taskExecutions.organizationId, organizationId))
      .orderBy(desc(taskExecutions.startTime))
      .limit(limit);
  }

  async createTaskExecution(insertExecution: InsertTaskExecution): Promise<TaskExecution> {
    const [execution] = await db
      .insert(taskExecutions)
      .values(insertExecution)
      .returning();
    return execution;
  }

  async updateTaskExecution(id: number, updates: Partial<TaskExecution>): Promise<TaskExecution | undefined> {
    const [execution] = await db
      .update(taskExecutions)
      .set(updates)
      .where(eq(taskExecutions.id, id))
      .returning();
    return execution || undefined;
  }

  // Usage tracking methods
  async getUsageByOrganization(organizationId: number, date?: Date): Promise<UsageTracking | undefined> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [usage] = await db
      .select()
      .from(usageTracking)
      .where(
        and(
          eq(usageTracking.organizationId, organizationId),
          sql`${usageTracking.date} >= ${startOfDay}`,
          sql`${usageTracking.date} < ${endOfDay}`
        )
      );
    return usage || undefined;
  }

  async createOrUpdateUsage(insertUsage: InsertUsageTracking): Promise<UsageTracking> {
    const existing = await this.getUsageByOrganization(insertUsage.organizationId);
    
    if (existing) {
      const [usage] = await db
        .update(usageTracking)
        .set({
          apiCalls: existing.apiCalls + (insertUsage.apiCalls || 0),
          browserSessions: existing.browserSessions + (insertUsage.browserSessions || 0),
          storageUsed: Math.max(existing.storageUsed, insertUsage.storageUsed || 0),
        })
        .where(eq(usageTracking.id, existing.id))
        .returning();
      return usage;
    } else {
      const [usage] = await db
        .insert(usageTracking)
        .values(insertUsage)
        .returning();
      return usage;
    }
  }
}

export const storage = new DatabaseStorage();
