import type { User } from '../types/user'

type LocalCheckedInUser = {
  userId: number
  userName?: string | null
  date: string
}

const LOCAL_CHECKED_IN_USERS_KEY = 'giga-attendance-checked-in-users'

function getTodayKey() {
  // Usa una fecha local simple para separar las entradas activas por dia.
  return new Date().toISOString().slice(0, 10)
}

function readCheckedInUsers(): LocalCheckedInUser[] {
  try {
    const rawValue = localStorage.getItem(LOCAL_CHECKED_IN_USERS_KEY)
    return rawValue ? JSON.parse(rawValue) as LocalCheckedInUser[] : []
  } catch {
    return []
  }
}

function saveCheckedInUsers(users: LocalCheckedInUser[]) {
  localStorage.setItem(LOCAL_CHECKED_IN_USERS_KEY, JSON.stringify(users))
}

export function rememberLocalCheckIn(user: User) {
  // Recuerda que este usuario ya marco entrada hoy para poder sugerir salida si luego no hay internet.
  const today = getTodayKey()
  const currentUsers = readCheckedInUsers().filter((item) => item.date === today && item.userId !== user.id)

  saveCheckedInUsers([
    ...currentUsers,
    {
      userId: user.id,
      userName: user.name,
      date: today,
    },
  ])
}

export function forgetLocalCheckIn(userId?: number | null) {
  // Limpia la entrada local cuando el usuario marca salida correctamente.
  if (!userId) return

  const today = getTodayKey()
  saveCheckedInUsers(readCheckedInUsers().filter((item) => !(item.date === today && item.userId === userId)))
}

export function hasLocalCheckIn(userId?: number | null): boolean {
  // Indica si un usuario especifico ya tiene entrada local registrada hoy.
  if (!userId) return false

  const today = getTodayKey()
  return readCheckedInUsers().some((item) => item.date === today && item.userId === userId)
}

export function getSingleLocalCheckedInUser(): LocalCheckedInUser | null {
  // Solo devuelve un usuario si no hay ambiguedad; con varios usuarios el backend debe decidir al sincronizar.
  const today = getTodayKey()
  const todayUsers = readCheckedInUsers().filter((item) => item.date === today)

  return todayUsers.length === 1 ? todayUsers[0] : null
}
