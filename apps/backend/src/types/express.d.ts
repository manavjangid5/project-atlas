declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      orgId?: string;
      role?: string;
    }

    interface Request {
      tenant?: {
        organizationId: string;
        role: string;
      };
    }
  }
}

export {};