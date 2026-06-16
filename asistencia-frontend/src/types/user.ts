export type UserType = 'ADMIN' | 'TECHNICIAN' | 'CLIENT' | 'SALES' | 'SECRETARY' | 'ACCOUNTANT'

export interface User {
  id: number
  name?: string | null
  lastName?: string | null
  username?: string | null
  password?: string | null
  dni?: string | null
  email?: string | null
  phone?: string | null
  verified?: boolean
  type?: UserType | null
}
