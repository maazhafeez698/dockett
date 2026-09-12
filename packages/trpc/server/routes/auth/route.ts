import { authenticatedProcedure, publicProcedure, router } from "../../trpc";

import {
  createUserWithEmailAndPasswordInputModel,
  createUserWithEmailAndPasswordOutputModel,
  signInUserWithEmailAndPasswordInputModel,
  signInUserWithEmailAndPasswordOutputModel,
  getLoggedInUserInfoInputModel,
  getLoggedInUserInfoOutputModel,
} from "./model";

import { userService } from "../../services";

import { generatePath } from "../../utils/path-generator";
import { singInUserWithEmailAndPassword } from "@repo/services/user/model";
const getPath = generatePath("/authentication");
const TAGS = ["Authentication"];

export const authRouter = router({
  createUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/createUserWithEmailAndPassword"),
        tags: TAGS,
      },
    })
    .input(createUserWithEmailAndPasswordInputModel)
    .output(createUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { fullName, email, password } = input;

      const createdUser = await userService.createUserWithEmailAndPassword({
        fullName,
        email,
        password,
      });

      const { id } = createdUser;
      const tokenValue =
        typeof createdUser.token === "string" ? createdUser.token : createdUser.token.token;

      ctx.setCookie("token", tokenValue, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return {
        id,
      };
    }),

  singInUserWithEmailAndPassword: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: getPath("/signInUserWithEmailAndPassword"),
        tags: TAGS,
      },
    })
    .input(signInUserWithEmailAndPasswordInputModel)
    .output(signInUserWithEmailAndPasswordOutputModel)
    .mutation(async ({ input, ctx }) => {
      const { email, password } = input;

      const createdUser = await userService.singInUserWithEmailAndPassword({
        email,
        password,
      });

      const { id } = createdUser;
      const tokenValue =
        typeof createdUser.token === "string" ? createdUser.token : createdUser.token.token;

      ctx.setCookie("token", tokenValue, {
        httpOnly: true,
        secure: false,
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      return {
        id,
      };
    }),

  getLoggedInUserInfo: authenticatedProcedure
    .meta({
      openapi: {
        method: "GET",
        path: getPath("/getLoggedInUserInfo"),
        tags: TAGS,
      },
    })
    .input(getLoggedInUserInfoInputModel)
    .output(getLoggedInUserInfoOutputModel)
    .query(async ({ ctx }) => {
      const { fullName, email, id } = await userService.getUserInfoById(ctx.user.id);

      return {
        id,
        fullName,
        email,
      };
    }),
});
