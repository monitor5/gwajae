import { useContext } from 'react'
import { UserWorkspaceContext } from './UserWorkspaceContext'

export function useUserWorkspace() {
  const context = useContext(UserWorkspaceContext)

  if (!context) {
    throw new Error('useUserWorkspace must be used inside UserWorkspaceProvider.')
  }

  return context
}
