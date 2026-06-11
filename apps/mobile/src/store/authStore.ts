import { create } from 'zustand';
import { authApi, spacesApi, tokenStorage, User, Space, Membership } from '../lib/api';

interface AuthState {
  token: string | null;
  profile: User | null;
  space: Space | null;
  memberships: Membership[];
  loading: boolean;
  initialized: boolean;
  setProfile: (profile: User | null) => void;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nombre: string, extraData?: { codigoInvitacion?: string; numeroUnidad?: string; telefono?: string; onboarding?: boolean }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  switchSpace: (spaceId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  profile: null,
  space: null,
  memberships: [],
  loading: true,
  initialized: false,

  setProfile: (profile) => set({ profile }),

  initialize: async () => {
    try {
      const token = await tokenStorage.get();
      if (token) {
        set({ token });
        await get().fetchProfile();
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({ loading: false, initialized: true });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    try {
      const { token, user } = await authApi.login(email, password);
      await tokenStorage.set(token);
      set({ token, profile: user });
      await get().fetchProfile();
      set({ loading: false });
      return { error: null };
    } catch (e) {
      set({ loading: false });
      return { error: e as Error };
    }
  },

  signUp: async (email, password, nombre, extraData) => {
    set({ loading: true });
    try {
      const { token, user } = await authApi.register({
        email,
        password,
        nombre,
        telefono: extraData?.telefono,
        codigoInvitacion: extraData?.codigoInvitacion,
        numeroUnidad: extraData?.numeroUnidad,
        onboarding: extraData?.onboarding,
      });
      await tokenStorage.set(token);
      set({ token, profile: user, loading: false });
      await get().fetchProfile();
      return { error: null };
    } catch (e) {
      set({ loading: false });
      return { error: e as Error };
    }
  },

  signOut: async () => {
    await tokenStorage.remove();
    set({ token: null, profile: null, space: null, memberships: [] });
  },

  switchSpace: async (spaceId: string) => {
    const { profile, memberships } = get();
    if (!profile) return;
    const membership = memberships.find((m) => m.spaceId === spaceId);
    if (!membership) throw new Error('No tenés membresía en ese espacio');
    const { space } = await spacesApi.getSpace(spaceId);
    set({
      space,
      profile: { ...profile, barrioId: spaceId, rol: membership.rol },
    });
  },

  fetchProfile: async () => {
    try {
      const { user } = await authApi.me();
      set({ profile: user });

      if (user.barrioId) {
        const { space } = await spacesApi.getSpace(user.barrioId);
        set({ space });
      } else {
        set({ space: null });
      }

      const { memberships } = await spacesApi.getMemberships();
      set({ memberships });
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
  },
}));
