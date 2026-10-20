import { Injectable, UnauthorizedException, ConflictException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from '../database/schemas/user.schema.js';
import { LoginDto, RegisterDto, AuthResponse, UserSummary, UserRole } from '@kitchentodoor/shared';
import { getRuntimeSettings } from '../config/runtime-settings.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ email: email.trim().toLowerCase() });
    if (!user) return null;
    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) return null;
    return user;
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role as any,
        phone: user.phone,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.userModel.findOne({ email: registerDto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('A user with this email address already exists');
    }

    const salt = await bcrypt.genSalt(getRuntimeSettings().PASSWORD_HASH_ROUNDS);
    const passwordHash = await bcrypt.hash(registerDto.password, salt);

    const newUser = await this.userModel.create({
      name: registerDto.name,
      email: registerDto.email.toLowerCase(),
      passwordHash,
      role: UserRole.CUSTOMER,
      phone: registerDto.phone,
    });

    const payload = {
      sub: newUser._id.toString(),
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role as any,
        phone: newUser.phone,
      },
    };
  }

  async verifyToken(token: string): Promise<UserSummary> {
    try {
      const decoded = this.jwtService.verify(token);
      return {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        name: decoded.name,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  async findById(id: string): Promise<UserSummary | null> {
    const user = await this.userModel.findById(id);
    if (!user) return null;
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role as any,
      phone: user.phone,
    };
  }
}
