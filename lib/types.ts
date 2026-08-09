export interface Profile {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface Email {
  id: string;
  user_id: string;
  folder: 'inbox' | 'sent' | 'trash';
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
}
