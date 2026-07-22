import React, { useEffect, useRef } from "react";
import { LogIn, LogOut, ShieldCheck, User } from "lucide-react";

export interface GoogleUser {
  email: string;
  name: string;
  picture: string;
  sub: string;
  token?: string;
}

interface GoogleAuthProps {
  user: GoogleUser | null;
  onSignIn: (user: GoogleUser) => void;
  onSignOut: () => void;
  clientId?: string;
  buttonId?: string;
  compact?: boolean;
}

// Decode Google JWT ID token payload safely
export function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error("Failed to parse Google JWT token:", err);
    return null;
  }
}

export const GOOGLE_CLIENT_ID =
  (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
  "299556828507-kiclj2qnevlics1mo8c35q5ugqp4vvbu.apps.googleusercontent.com";

export function GoogleAuth({
  user,
  onSignIn,
  onSignOut,
  clientId = GOOGLE_CLIENT_ID,
  buttonId = "google-signin-btn",
  compact = false
}: GoogleAuthProps) {
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) return;

    const initializeGsi = () => {
      if ((window as any).google?.accounts?.id) {
        (window as any).google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            if (response.credential) {
              const payload = parseJwt(response.credential);
              if (payload) {
                const newUser: GoogleUser = {
                  email: payload.email,
                  name: payload.name || payload.email.split("@")[0],
                  picture: payload.picture,
                  sub: payload.sub,
                  token: response.credential
                };
                onSignIn(newUser);
              }
            }
          }
        });

        if (buttonRef.current) {
          (window as any).google.accounts.id.renderButton(buttonRef.current, {
            theme: "filled_blue",
            size: compact ? "medium" : "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left"
          });
        }
      }
    };

    // If GSI script is loaded, initialize immediately; otherwise poll briefly
    if ((window as any).google?.accounts?.id) {
      initializeGsi();
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(interval);
          initializeGsi();
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [user, clientId, compact, onSignIn]);

  if (user) {
    return (
      <div className="flex items-center gap-2.5 bg-[#1a1d26] border border-indigo-500/30 px-3 py-1.5 rounded-lg shadow-sm">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            className="w-7 h-7 rounded-full border border-indigo-400/40 object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex flex-col text-left">
          <span className="text-xs font-semibold text-gray-200 truncate max-w-[120px] md:max-w-[160px]">
            {user.name}
          </span>
          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
            <ShieldCheck size={10} /> Google Account
          </span>
        </div>

        <button
          onClick={onSignOut}
          className="ml-1 text-gray-400 hover:text-red-400 p-1 transition-colors rounded hover:bg-white/5"
          title="Sign out of Google Account"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div ref={buttonRef} id={buttonId}></div>
    </div>
  );
}
