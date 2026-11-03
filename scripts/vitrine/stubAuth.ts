export const useAuth = () => ({
  empresaId: "emp-1", empresaScopeIds: ["emp-1"], isSuperAdmin: false,
  user: { id: "u1", email: "tecnico@empresa.com" },
});
export const AuthProvider = ({ children }: any) => children;
