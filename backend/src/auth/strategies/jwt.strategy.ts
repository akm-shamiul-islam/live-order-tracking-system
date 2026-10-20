import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { getJwtSecret } from '../jwt.config.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: { sub: string; email: string; role: string; name: string }) {
    if (!payload.sub) {
      throw new UnauthorizedException();
    }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  }
}
