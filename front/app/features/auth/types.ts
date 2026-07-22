export interface User {
  id: number;
  username: string;
  email: string;
  language: string;
  is_customer: boolean;
  is_administrator: boolean;
}

export interface PasswordPolicy {
  min_length: number;
  special_chars: string;
}
