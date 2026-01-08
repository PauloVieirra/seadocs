import { useState, useEffect, useMemo } from 'react';
import { Check, X, Search } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { type User } from '../../services/api';

interface UserSearchSelectProps {
  users: User[];
  selectedUsers: string[];
  onSelectionChange: (selectedUsers: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxSelected?: number;
}

export function UserSearchSelect({
  users,
  selectedUsers = [],
  onSelectionChange,
  placeholder = "Digite para buscar usuários...",
  disabled = false,
  maxSelected
}: UserSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar usuários baseado na busca (a partir de 4 caracteres)
  const filteredUsers = useMemo(() => {
    if (searchQuery.length < 4) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const selectedUserObjects = users.filter(user => selectedUsers && selectedUsers.includes(user.id));

  const handleSelect = (userId: string) => {
    const currentSelected = selectedUsers || [];
    const newSelected = currentSelected.includes(userId)
      ? currentSelected.filter(id => id !== userId)
      : [...currentSelected, userId];

    if (maxSelected && newSelected.length > maxSelected) {
      return; // Não permite selecionar mais que o máximo
    }

    onSelectionChange(newSelected);
  };

  const handleRemoveUser = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedUsers.filter(id => id !== userId));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn(
            "w-full justify-between flex-wrap h-auto min-h-9",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
        >
          {selectedUserObjects.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {selectedUserObjects.map((user) => (
                <Badge key={user.id} variant="secondary" className="pl-1">
                  {user.name}
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer"
                    onClick={(e) => handleRemoveUser(user.id, e)}
                  />
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <Search className="h-4 w-4 shrink-0 opacity-50 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite pelo menos 4 letras..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {searchQuery.length < 4 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Digite pelo menos 4 letras para buscar
              </div>
            ) : filteredUsers.length === 0 ? (
              <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {filteredUsers.map((user) => (
                  <CommandItem
                    key={user.id}
                    onSelect={() => handleSelect(user.id)}
                    className="flex cursor-pointer items-center justify-between"
                  >
                    <div className="flex items-center">
                      <span>{user.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">({user.email})</span>
                    </div>
                    {selectedUsers && selectedUsers.includes(user.id) && (
                      <Check className="h-4 w-4" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}