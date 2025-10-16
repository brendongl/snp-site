import { Adapter, AdapterUser, AdapterSession, AdapterAccount, VerificationToken } from 'next-auth/adapters';
import Airtable from 'airtable';

interface AirtableAdapterOptions {
  apiKey: string;
  baseId: string;
  tableNames?: {
    users?: string;
    accounts?: string;
    sessions?: string;
    verificationTokens?: string;
  };
}

export function AirtableAdapter(options: AirtableAdapterOptions): Adapter {
  const {
    apiKey,
    baseId,
    tableNames = {
      users: 'Users',
      accounts: 'Accounts',
      sessions: 'Sessions',
      verificationTokens: 'VerificationTokens',
    },
  } = options;

  // Initialize Airtable
  const base = new Airtable({ apiKey }).base(baseId);

  // Helper function to convert Airtable record to AdapterUser
  const recordToUser = (record: any): AdapterUser => ({
    id: record.id,
    email: record.fields.email,
    emailVerified: record.fields.emailVerified ? new Date(record.fields.emailVerified) : null,
    name: record.fields.name,
    image: record.fields.image,
  });

  // Helper function to convert Airtable record to AdapterSession
  const recordToSession = (record: any): AdapterSession => ({
    sessionToken: record.fields.sessionToken,
    userId: record.fields.userId,
    expires: new Date(record.fields.expires),
  });

  // Helper function to convert Airtable record to AdapterAccount
  const recordToAccount = (record: any): AdapterAccount => ({
    userId: record.fields.userId,
    type: record.fields.type,
    provider: record.fields.provider,
    providerAccountId: record.fields.providerAccountId,
    refresh_token: record.fields.refresh_token,
    access_token: record.fields.access_token,
    expires_at: record.fields.expires_at,
    token_type: record.fields.token_type,
    scope: record.fields.scope,
    id_token: record.fields.id_token,
    session_state: record.fields.session_state,
  });

  return {
    async createUser(user) {
      try {
        const records = await base(tableNames.users!).create([
          {
            fields: {
              email: user.email,
              emailVerified: user.emailVerified?.toISOString(),
              name: user.name,
              image: user.image,
            },
          },
        ]);
        return recordToUser(records[0]);
      } catch (error) {
        console.error('Error creating user:', error);
        throw error;
      }
    },

    async getUser(id) {
      try {
        const record = await base(tableNames.users!).find(id);
        return recordToUser(record);
      } catch (error) {
        console.error('Error getting user:', error);
        return null;
      }
    },

    async getUserByEmail(email) {
      try {
        const records = await base(tableNames.users!)
          .select({
            filterByFormula: `{email} = "${email}"`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length === 0) return null;
        return recordToUser(records[0]);
      } catch (error) {
        console.error('Error getting user by email:', error);
        return null;
      }
    },

    async getUserByAccount({ provider, providerAccountId }) {
      try {
        const records = await base(tableNames.accounts!)
          .select({
            filterByFormula: `AND({provider} = "${provider}", {providerAccountId} = "${providerAccountId}")`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length === 0) return null;

        const userId = records[0].fields.userId as string;
        const user = await base(tableNames.users!).find(userId);
        return recordToUser(user);
      } catch (error) {
        console.error('Error getting user by account:', error);
        return null;
      }
    },

    async updateUser(user) {
      try {
        const updates: any = {};
        if (user.email !== undefined) updates.email = user.email;
        if (user.emailVerified !== undefined) updates.emailVerified = user.emailVerified?.toISOString();
        if (user.name !== undefined) updates.name = user.name;
        if (user.image !== undefined) updates.image = user.image;

        const records = await base(tableNames.users!).update([
          {
            id: user.id,
            fields: updates,
          },
        ]);
        return recordToUser(records[0]);
      } catch (error) {
        console.error('Error updating user:', error);
        throw error;
      }
    },

    async deleteUser(userId) {
      try {
        await base(tableNames.users!).destroy([userId]);
      } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
      }
    },

    async linkAccount(account) {
      try {
        await base(tableNames.accounts!).create([
          {
            fields: {
              userId: account.userId,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state,
            },
          },
        ]);
        return account;
      } catch (error) {
        console.error('Error linking account:', error);
        throw error;
      }
    },

    async unlinkAccount({ provider, providerAccountId }) {
      try {
        const records = await base(tableNames.accounts!)
          .select({
            filterByFormula: `AND({provider} = "${provider}", {providerAccountId} = "${providerAccountId}")`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length > 0) {
          await base(tableNames.accounts!).destroy([records[0].id]);
        }
      } catch (error) {
        console.error('Error unlinking account:', error);
        throw error;
      }
    },

    async getAccount(providerAccountId, provider) {
      try {
        const records = await base(tableNames.accounts!)
          .select({
            filterByFormula: `AND({provider} = "${provider}", {providerAccountId} = "${providerAccountId}")`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length === 0) return null;
        return recordToAccount(records[0]);
      } catch (error) {
        console.error('Error getting account:', error);
        return null;
      }
    },

    async createSession(session) {
      try {
        const records = await base(tableNames.sessions!).create([
          {
            fields: {
              sessionToken: session.sessionToken,
              userId: session.userId,
              expires: session.expires.toISOString(),
            },
          },
        ]);
        return recordToSession(records[0]);
      } catch (error) {
        console.error('Error creating session:', error);
        throw error;
      }
    },

    async getSessionAndUser(sessionToken) {
      try {
        const records = await base(tableNames.sessions!)
          .select({
            filterByFormula: `{sessionToken} = "${sessionToken}"`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length === 0) return null;

        const session = recordToSession(records[0]);
        const user = await base(tableNames.users!).find(session.userId);

        return {
          session,
          user: recordToUser(user),
        };
      } catch (error) {
        console.error('Error getting session and user:', error);
        return null;
      }
    },

    async updateSession(session) {
      try {
        const records = await base(tableNames.sessions!)
          .select({
            filterByFormula: `{sessionToken} = "${session.sessionToken}"`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length === 0) return null;

        const updated = await base(tableNames.sessions!).update([
          {
            id: records[0].id,
            fields: {
              expires: session.expires?.toISOString(),
              userId: session.userId,
            },
          },
        ]);

        return recordToSession(updated[0]);
      } catch (error) {
        console.error('Error updating session:', error);
        return null;
      }
    },

    async deleteSession(sessionToken) {
      try {
        const records = await base(tableNames.sessions!)
          .select({
            filterByFormula: `{sessionToken} = "${sessionToken}"`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length > 0) {
          await base(tableNames.sessions!).destroy([records[0].id]);
        }
      } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
      }
    },

    async createVerificationToken(verificationToken) {
      try {
        await base(tableNames.verificationTokens!).create([
          {
            fields: {
              identifier: verificationToken.identifier,
              token: verificationToken.token,
              expires: verificationToken.expires.toISOString(),
            },
          },
        ]);
        return verificationToken;
      } catch (error) {
        console.error('Error creating verification token:', error);
        throw error;
      }
    },

    async useVerificationToken({ identifier, token }) {
      try {
        const records = await base(tableNames.verificationTokens!)
          .select({
            filterByFormula: `AND({identifier} = "${identifier}", {token} = "${token}")`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length === 0) return null;

        const verificationToken = {
          identifier: records[0].fields.identifier as string,
          token: records[0].fields.token as string,
          expires: new Date(records[0].fields.expires as string),
        };

        await base(tableNames.verificationTokens!).destroy([records[0].id]);

        return verificationToken;
      } catch (error) {
        console.error('Error using verification token:', error);
        return null;
      }
    },
  };
}