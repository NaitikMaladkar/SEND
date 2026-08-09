import { Resend } from 'resend';

let resendInstance = null;

export function getResendClient() {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}
