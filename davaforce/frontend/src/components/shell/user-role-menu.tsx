"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Loader2, LogOut, MessageSquareText, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserRoleMenuProps = {
  userId: string;
  username: string;
  role?: string;
  profileImage?: string;
  onSignOut?: () => void;
};

type RolesPayload = {
  status: "success" | "failure";
  roles?: string[];
  user?: {
    userId: string;
    username: string;
    role: string;
    profileImage: string;
  };
  error?: string;
};

const profileImageSrc = (profileImage: string) =>
  profileImage ? `data:image/svg+xml;base64,${profileImage}` : "";

export function UserRoleMenu({ userId, username, role, profileImage = "", onSignOut }: UserRoleMenuProps) {
  const [currentRole, setCurrentRole] = useState(role ?? "Loading role");
  const [currentProfileImage, setCurrentProfileImage] = useState(profileImage);
  const [availableRoles, setAvailableRoles] = useState<string[]>(role ? [role] : []);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (role) {
      setCurrentRole(role);
    }
  }, [role]);

  useEffect(() => {
    if (profileImage) {
      setCurrentProfileImage(profileImage);
    }
  }, [profileImage]);

  useEffect(() => {
    let cancelled = false;

    if (!userId) {
      setAvailableRoles((current) => (current.length ? current : role ? [role] : []));
      if (role) {
        setCurrentRole(role);
      }
      return () => {
        cancelled = true;
      };
    }

    const loadRoles = async () => {
      setIsLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ userId });
        const response = await fetch(`/api/auth/roles?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as RolesPayload;
        if (!response.ok || payload.status !== "success") {
          throw new Error(payload.error ?? "Failed to load roles.");
        }

        if (cancelled) return;

        const roles = payload.roles?.length ? payload.roles : role ? [role] : [];
        setAvailableRoles(roles);
        const nextRole = payload.user?.role ?? role ?? roles[0] ?? "No role assigned";
        setCurrentRole(nextRole);
        setCurrentProfileImage(payload.user?.profileImage ?? profileImage);
      } catch (loadError) {
        if (cancelled) return;
        setAvailableRoles((current) => (current.length ? current : role ? [role] : []));
        setError(loadError instanceof Error ? loadError.message : "Failed to load roles.");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [role, userId]);

  const changeRole = async (nextRole: string) => {
    if (!userId || !nextRole || nextRole === currentRole || isUpdating) return;

    setIsUpdating(true);
    setError("");
    try {
      const response = await fetch("/api/auth/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      const payload = (await response.json()) as RolesPayload;
      if (!response.ok || payload.status !== "success" || !payload.user) {
        throw new Error(payload.error ?? "Failed to update role.");
      }

      setCurrentRole(payload.user.role);
      setCurrentProfileImage(payload.user.profileImage);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update role.");
    } finally {
      setIsUpdating(false);
    }
  };

  const avatarSrc = profileImageSrc(currentProfileImage);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hidden cursor-pointer items-center gap-3 rounded-full border border-transparent bg-transparent py-1 pl-1 pr-2 text-left text-sm text-[var(--home-muted)] transition-all duration-200 hover:border-[var(--home-border)] hover:bg-[var(--home-panel-strong)] hover:text-[var(--home-text)] hover:shadow-[0_10px_26px_rgba(25,43,55,0.08)] data-[state=open]:border-[var(--home-border)] data-[state=open]:bg-[var(--home-panel-strong)] data-[state=open]:shadow-[0_10px_26px_rgba(25,43,55,0.08)] md:flex"
        >
          <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--home-border)] bg-[var(--home-soft)]">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-brand/10 text-sm font-semibold text-brand">
                {username.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-[var(--home-text)]">{username}</span>
            <span className="block truncate text-xs text-[var(--home-muted)]">{currentRole}</span>
          </span>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--home-muted)]">
            {isLoading || isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border-[var(--home-border)] bg-[var(--home-panel)] p-3 text-left text-[var(--home-text)]">
        <DropdownMenuLabel className="flex items-center gap-3 px-0">
          <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[var(--home-border)] bg-[var(--home-soft)]">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-brand/10 text-sm font-semibold text-brand">
                {username.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm">{username}</span>
            <span className="mt-1 block truncate text-xs font-normal text-[var(--home-muted)]">{currentRole}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[var(--home-border)]" />
        <DropdownMenuItem asChild className="mt-2 cursor-pointer rounded-md p-0 focus:bg-[var(--home-soft)]">
          <Link href="/workspace" className="flex w-full items-center justify-start gap-2 rounded-md px-2 py-2 text-left text-sm">
            <MessageSquareText className="h-4 w-4 text-brand" />
            Open chat workspace
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-md p-0 focus:bg-[var(--home-soft)]">
          <Link href="/?action=upload" className="flex w-full items-center justify-start gap-2 rounded-md px-2 py-2 text-left text-sm">
            <Upload className="h-4 w-4 text-brand" />
            Upload data
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[var(--home-border)]" />
        <div className="space-y-2 pt-2">
          <div className="text-xs font-medium text-[var(--home-muted)]">Change role</div>
          <Select value={currentRole} onValueChange={(value) => void changeRole(value)} disabled={isLoading || isUpdating}>
            <SelectTrigger className="h-10 cursor-pointer border-[var(--home-border)] bg-[var(--home-panel-strong)] text-left text-[var(--home-text)] transition hover:border-brand/50 hover:bg-[var(--home-soft)] disabled:cursor-not-allowed [&>span]:text-left">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent className="border-[var(--home-border)] bg-[var(--home-panel-strong)] text-[var(--home-text)]">
              {availableRoles.map((option) => (
                <SelectItem
                  key={option}
                  value={option}
                  className="cursor-pointer justify-start text-left text-[var(--home-text)] focus:bg-brand/10 focus:text-[var(--home-text)] data-[state=checked]:bg-brand/10"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error ? <div className="text-xs text-brand">{error}</div> : null}
        </div>
        {onSignOut ? (
          <>
            <DropdownMenuSeparator className="my-3 bg-[var(--home-border)]" />
            <DropdownMenuItem
              className="cursor-pointer rounded-md px-2 py-2 text-left text-sm font-medium text-[#d93f32] focus:bg-[#ff5640]/10 focus:text-[#d93f32]"
              onSelect={onSignOut}
            >
              <LogOut className="h-4 w-4 text-[#d93f32]" />
              Sign out
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
