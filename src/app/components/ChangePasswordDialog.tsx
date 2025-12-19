import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { apiService, User } from '../../services/api';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ChangePasswordDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPasswordChanged: () => void; // Callback quando a senha é alterada com sucesso
  forceChange?: boolean; // Se true, não permite fechar o diálogo
}

export function ChangePasswordDialog({
  user,
  open,
  onOpenChange,
  onPasswordChanged,
  forceChange = false,
}: ChangePasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong'>('weak');

  // Calcula a força da senha
  const evaluatePasswordStrength = (password: string) => {
    if (password.length < 6) {
      setPasswordStrength('weak');
    } else if (password.length < 10 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setPasswordStrength('medium');
    } else {
      setPasswordStrength('strong');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setNewPassword(password);
    evaluatePasswordStrength(password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!newPassword) {
      toast.error('Digite uma nova senha');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      await apiService.updateUserPassword(user.id, newPassword);
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
      onPasswordChanged();
      if (!forceChange) {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast.error(`Erro ao alterar senha: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (passwordStrength) {
      case 'weak':
        return 'bg-red-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'strong':
        return 'bg-green-500';
    }
  };

  const getStrengthLabel = () => {
    switch (passwordStrength) {
      case 'weak':
        return 'Fraca';
      case 'medium':
        return 'Média';
      case 'strong':
        return 'Forte';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => {
          if (forceChange) {
            e.preventDefault();
          }
        }}
        onClick={(e) => {
          if (forceChange && e.currentTarget === e.target) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {forceChange ? (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                Alterar Senha (Obrigatório)
              </>
            ) : (
              'Alterar Senha'
            )}
          </DialogTitle>
          <DialogDescription>
            {forceChange
              ? 'Por sua segurança, você deve alterar sua senha no primeiro acesso.'
              : 'Altere sua senha para uma nova e segura.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha *</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Digite sua nova senha"
              value={newPassword}
              onChange={handlePasswordChange}
              disabled={loading}
              required
            />
            {newPassword && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
                    <div
                      className={`h-full ${getStrengthColor()} transition-all`}
                      style={{
                        width: passwordStrength === 'weak' ? '33%' : passwordStrength === 'medium' ? '66%' : '100%',
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-600">
                    Força: {getStrengthLabel()}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Mínimo 6 caracteres. Use letras maiúsculas e números para maior segurança.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Senha *</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Confirme sua nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
            {confirmPassword && newPassword === confirmPassword && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                As senhas conferem
              </div>
            )}
            {confirmPassword && newPassword !== confirmPassword && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                As senhas não conferem
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            {!forceChange && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
