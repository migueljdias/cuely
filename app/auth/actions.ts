"use server";

import { redirect } from "next/navigation";
import { authConfigured, getAuth } from "@/auth/server";

export type FormState = { error: string } | null;

const NOT_READY = "Accounts are not switched on yet. Cuely works without one: connect the endpoint and go.";

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured()) return { error: NOT_READY };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const name = String(form.get("name") ?? "").trim() || email.split("@")[0];
  if (!email || !password) return { error: "Enter an email and a password." };
  if (password.length < 8) return { error: "Use a password of at least 8 characters." };
  const { error } = await getAuth().signUp.email({ email, password, name });
  if (error) return { error: error.message || "Couldn't create the account. Try again." };
  redirect("/account");
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!authConfigured()) return { error: NOT_READY };
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const { error } = await getAuth().signIn.email({ email, password });
  if (error) return { error: error.message || "That email and password didn't match." };
  redirect("/account");
}

export async function signOutAction(): Promise<void> {
  if (authConfigured()) await getAuth().signOut();
  redirect("/");
}
