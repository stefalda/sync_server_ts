import { User } from '../models/db/models';
import { UserToken } from '../models/db/models';

// TypeScript declaration merging: adds userToken and user to express.Request.
// Previously code used `(req as any).userToken` and `(req as any).user` everywhere,
// losing type safety. This augmentation makes them available on all Request objects
// without casts, matching the pattern used by express-serve-static-core for other
// built-in properties like req.query, req.params, etc.
declare global {
  namespace Express {
    interface Request {
      userToken?: UserToken;
      user?: User;
    }
  }
}
