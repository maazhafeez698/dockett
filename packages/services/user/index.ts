import { db, eq } from "@repo/database";
import { usersTable } from "@repo/database/models/user";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { env } from "../env";

import {
  createUserWithEmailAndPassword,
  type CreateUserWithEmailAndPasswordType,
  generateUserTokenPayload,
  type GenerateUserTokenPayloadType,
  singInUserWithEmailAndPassword,
  type SingInUserWithEmailAndPasswordType,
} from "./model";

export default class UserService {
  private async getUserByEmail(email: string) {
    const result = await db.select().from(usersTable).where(eq(usersTable.email, email));

    if (!result || result.length === 0) return null;

    return result[0];
  }

  private async generateUserToken(payload: GenerateUserTokenPayloadType) {
    const { id } = await generateUserTokenPayload.parseAsync(payload);

    const token = jwt.sign({ id }, env.JWT_SECRET);

    return { token };
  }

  public async createUserWithEmailAndPassword(payload: CreateUserWithEmailAndPasswordType) {
    const { fullName, email, password } = await createUserWithEmailAndPassword.parseAsync(payload);

    const existingUser = await this.getUserByEmail(email);

    if (existingUser) throw new Error("User with this email already exists");

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db
      .insert(usersTable)
      .values({ fullName, email, passwordHash })
      .returning({ id: usersTable.id });

    if (!result || result.length === 0 || !result[0]?.id) throw new Error("Failed to create user");

    const token = await this.generateUserToken({ id: result[0].id });

    return {
      id: result[0].id,
      token,
    };
  }

  public async singInUserWithEmailAndPassword(payload: SingInUserWithEmailAndPasswordType) {
    const { email, password } = await singInUserWithEmailAndPassword.parseAsync(payload);

    const existingUser = await this.getUserByEmail(email);
    if (!existingUser) {
      throw new Error("User with this email does not exist");
    }

    if (!existingUser.passwordHash) {
      throw new Error("Invalid authentication method");
    }

    const isValid = await bcrypt.compare(password, existingUser.passwordHash);
    if (!isValid) throw new Error("Invalid email address or password");

    const token = await this.generateUserToken({ id: existingUser.id });

    return {
      id: existingUser.id,
      token,
    };
  }

  public async getUserInfoById(id: string) {
    const user = await db
      .select({ id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, id));

    if (!user || user.length === 0) throw new Error("User with this ID does not exist");

    return user[0]!;
  }

  public async verifyAndDecodeUserToken(token: string) {
    try {
      const result = jwt.verify(token, env.JWT_SECRET) as GenerateUserTokenPayloadType;

      return result;
    } catch (error) {
      throw new Error("Invalid token");
    }
  }
}
