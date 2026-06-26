'use client'

import { useState, useEffect } from 'react'
import { isAuthenticated, login } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { Lock } from 'lucide-react'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setIsAuth(isAuthenticated())
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (login(password)) {
      setIsAuth(true)
      setError('')
    } else {
      setError('Invalid password')
    }
  }

  if (isAuth === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter the password to access the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin}>
              <FieldGroup>
                <Field>
                  <FieldLabel>Password</FieldLabel>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoFocus
                  />
                  {error && <p className="text-sm text-destructive mt-1">{error}</p>}
                </Field>
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
