"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/actions/auth";
import { Banner } from "@/components/ui";
import { TextField } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit";

export function SignInForm() {
  const [state, action] = useActionState(signInAction, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? <Banner tone="error">{state.error}</Banner> : null}
      <TextField id="email" name="email" type="email" label="Work email" autoComplete="username" required autoFocus />
      <TextField id="password" name="password" type="password" label="Password" autoComplete="current-password" required />
      <SubmitButton className="w-full">Sign in</SubmitButton>
    </form>
  );
}
