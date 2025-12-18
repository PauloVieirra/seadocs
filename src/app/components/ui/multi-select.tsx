"use client";

import * as React from "react";
import { X, Check, ChevronDown } from "lucide-react";

import { cn } from "./utils";
import { Badge } from "./badge";
import { Command, CommandGroup, CommandItem } from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Button } from "./button";

export interface MultiSelectOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onSelectedChange: (selected: string[]) => void;
  placeholder?: string;
  maxSelected?: number;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onSelectedChange,
  placeholder = "Selecione opções...",
  maxSelected,
  className,
  disabled,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];

    if (maxSelected && newSelected.length > maxSelected) {
      return; // Prevent selecting more than maxSelected
    }
    onSelectedChange(newSelected);
  };

  const selectedOptions = options.filter((option) =>
    selected.includes(option.value)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn(
            "w-full justify-between flex-wrap h-auto min-h-9",
            className
          )}
          disabled={disabled}
        >
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {selectedOptions.map((option) => (
                <Badge key={option.value} variant="secondary" className="pl-1">
                  {option.icon && (
                    <option.icon className="mr-1 h-3 w-3 text-current" />
                  )}
                  {option.label}
                  <X
                    className="ml-1 h-3 w-3 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelect(option.value);
                    }}
                  />
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50 ml-auto" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command className="p-1">
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => handleSelect(option.value)}
                className="flex cursor-pointer items-center justify-between"
              >
                <div className="flex items-center">
                  {option.icon && (
                    <option.icon className="mr-2 h-4 w-4" />
                  )}
                  <span>{option.label}</span>
                </div>
                {selected.includes(option.value) && (
                  <Check className="h-4 w-4" />
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}



