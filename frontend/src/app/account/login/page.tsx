import { AccountForm } from "@/components/account-form";

export const metadata = { title: "Sign in to your account" };

export default function LoginPage() {
  return <AccountForm mode="login" />;
}
