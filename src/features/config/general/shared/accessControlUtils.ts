export const createEmptyPermission = (role: string, module: string) => ({
  id: "",
  role,
  module,
  can_view: false,
  can_edit: false,
  created_at: "",
  updated_at: "",
});
