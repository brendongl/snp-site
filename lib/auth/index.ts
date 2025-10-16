import NextAuth from 'next-auth';
import type { NextAuthConfig } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { AirtableAdapter } from './airtable-adapter';

const authConfig: NextAuthConfig = {
  adapter: AirtableAdapter({
    apiKey: process.env.AIRTABLE_API_KEY!,
    baseId: process.env.AIRTABLE_BASE_ID!,
    tableNames: {
      users: 'Users',
      accounts: 'Accounts',
      sessions: 'Sessions',
      verificationTokens: 'VerificationTokens',
    },
  }),

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // TODO: Implement proper password verification with Airtable
        // For now, this is a placeholder - you'll need to implement proper auth
        // This would typically involve:
        // 1. Looking up the user in Airtable by email
        // 2. Verifying the password (hashed)
        // 3. Returning the user object if valid

        try {
          // Placeholder - replace with actual Airtable lookup
          const user = {
            id: '1',
            email: credentials.email as string,
            name: 'Test User',
          };

          return user;
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],

  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },

  session: {
    strategy: 'jwt',
  },

  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);