import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '../services/auth';

type SessionState = { session: Session | null; ready: boolean };

export const useSession = create<SessionState>(() => ({ session: null, ready: false }));

let started = false;

// Loads the saved session and keeps it up to date.
export function initSession() {
  if (started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) =>
    useSession.setState({ session: data.session, ready: true })
  );
  supabase.auth.onAuthStateChange((_event, session) =>
    useSession.setState({ session, ready: true })
  );
}