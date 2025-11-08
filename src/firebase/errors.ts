export type SecurityRuleContext = {
    path: string;
    operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
    requestResourceData?: any;
  };
  
  export class FirestorePermissionError extends Error {
    public readonly context: SecurityRuleContext;
  
    constructor(context: SecurityRuleContext) {
      const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(context, null, 2)}`;
      super(message);
      this.name = 'FirestorePermissionError';
      this.context = context;
  
      // This is to ensure the stack trace is captured correctly
      if (typeof Error.captureStackTrace === 'function') {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = new Error(message).stack;
      }
    }
  }
  