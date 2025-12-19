import React, { useState, useRef, useEffect } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { User } from '../../services/api';
import { X, Search } from 'lucide-react';

interface UserSearchSelectProps {
  users: User[];
  selectedIds: string[];
  onSelectedChange: (ids: string[]) => void;
  placeholder?: string;
  maxResults?: number;
}

export function UserSearchSelect({
  users,
  selectedIds,
  onSelectedChange,
  placeholder = 'Busque por nome ou email...',
  maxResults = 8,
}: UserSearchSelectProps) {
  const [searchInput, setSearchInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Calcula score de similaridade entre string de busca e texto
  const calculateSimilarity = (searchTerm: string, text: string): number => {
    const search = searchTerm.toLowerCase();
    const target = text.toLowerCase();

    // Exacto no início (score mais alto)
    if (target.startsWith(search)) {
      return 100;
    }

    // Contém a palavra (score médio)
    if (target.includes(search)) {
      return 75;
    }

    // Letras consecutivas (score mais baixo)
    let currentIndex = 0;
    for (let i = 0; i < search.length; i++) {
      const char = search[i];
      const nextIndex = target.indexOf(char, currentIndex);
      if (nextIndex === -1) {
        return 0; // Não contém a letra
      }
      currentIndex = nextIndex + 1;
    }

    return 50;
  };

  // Filtra usuários baseado na entrada de busca
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setIsOpen(true);

    if (value.trim().length === 0) {
      setFilteredUsers([]);
      return;
    }

    // Busca em nome e email
    const results = users
      .filter(user => !selectedIds.includes(user.id)) // Não mostrar já selecionados
      .map(user => ({
        user,
        score: Math.max(
          calculateSimilarity(value, user.name),
          calculateSimilarity(value, user.email)
        ),
      }))
      .filter(item => item.score > 0) // Apenas resultados com match
      .sort((a, b) => b.score - a.score) // Ordenar por relevância
      .slice(0, maxResults) // Limitar a X resultados
      .map(item => item.user);

    setFilteredUsers(results);
  };

  // Seleciona um usuário
  const handleSelectUser = (userId: string) => {
    onSelectedChange([...selectedIds, userId]);
    setSearchInput('');
    setFilteredUsers([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Remove um usuário selecionado
  const handleRemoveUser = (userId: string) => {
    onSelectedChange(selectedIds.filter(id => id !== userId));
  };

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dados dos usuários selecionados
  const selectedUsers = users.filter(u => selectedIds.includes(u.id));

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => searchInput && setIsOpen(true)}
            className="pl-10"
          />
        </div>

        {/* Dropdown de resultados */}
        {isOpen && filteredUsers.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
            {filteredUsers.map(user => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user.id)}
                className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium text-sm text-gray-900">{user.name}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
              </button>
            ))}
          </div>
        )}

        {/* Mensagem quando não há resultados */}
        {isOpen && searchInput.trim().length > 0 && filteredUsers.length === 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3">
            <p className="text-sm text-gray-500 text-center">Nenhum usuário encontrado</p>
          </div>
        )}
      </div>

      {/* Usuários selecionados como tags */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map(user => (
            <div
              key={user.id}
              className="inline-flex items-center gap-2 bg-blue-100 text-blue-900 px-3 py-1 rounded-full text-sm"
            >
              <span className="font-medium">{user.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveUser(user.id)}
                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Contador de selecionados */}
      {selectedUsers.length > 0 && (
        <p className="text-xs text-gray-500">
          {selectedUsers.length} usuário(s) selecionado(s)
        </p>
      )}
    </div>
  );
}
