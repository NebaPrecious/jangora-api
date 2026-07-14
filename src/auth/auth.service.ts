import { Injectable } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase-admin/firebase-admin.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly usersService: UsersService,
  ) {}

  async firebaseLogin(idToken: string) {
    const decodedToken = await this.firebaseAdminService.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email || '';
    const displayName = decodedToken.name || '';
    const photoURL = decodedToken.picture || '';

    let user = await this.usersService.findByFirebaseUid(firebaseUid);

    if (!user && email) {
      user = await this.usersService.findByEmail(email);
    }

    if (!user) {
      const [firstName, ...remainingName] = displayName ? displayName.split(' ') : [email.split('@')[0]];
      const lastName = remainingName.join(' ') || '';

      user = await this.usersService.createUser({
        firebaseUid,
        email,
        firstName: firstName || 'User',
        lastName: lastName || 'Jangora',
        profileImageUrl: photoURL || null,
        authProvider: 'firebase',
      });
    }

    return {
      user,
      firebaseUid,
      email,
    };
  }
}
