"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Wordmark } from "./Wordmark";
import { SAB } from "./tokens";

// Left-rail app shell — fixed 236px, collapsible. Sections separated by mono eyebrows.
// Source: handoff shell.jsx · Sidebar.

type NavItem = { kind: "item"; key: string; label: string; icon: IconName; href: string; count?: number; badge?: boolean };
type NavSep = { kind: "sep"; label: string };
type NavNode = NavItem | NavSep;

const NAV: NavNode[] = [
  { kind: "item", key: "home", label: "Home", icon: "home", href: "/dashboard" },
  { kind: "item", key: "projects", label: "Projects", icon: "folder", href: "/projects" },

  { kind: "sep", label: "Sales" },
  { kind: "item", key: "clients", label: "Clients", icon: "building", href: "/clients" },
  { kind: "item", key: "quotes", label: "Quotes", icon: "quote", href: "/quotes" },
  { kind: "item", key: "invoices", label: "Tax invoices", icon: "invoice", href: "/invoices" },

  { kind: "sep", label: "Operations" },
  { kind: "item", key: "timesheets", label: "Timesheets", icon: "clock", href: "/timesheets" },
  { kind: "item", key: "inventory", label: "Inventory", icon: "box", href: "/inventory" },
  { kind: "item", key: "overhead", label: "Overhead", icon: "briefcase", href: "/overhead" },
  { kind: "item", key: "reports", label: "Reports", icon: "report", href: "/reports" },

  { kind: "sep", label: "Procurement" },
  { kind: "item", key: "vendors", label: "Vendors", icon: "building", href: "/procurement/vendors" },
  { kind: "item", key: "po", label: "Purchase orders", icon: "invoice", href: "/procurement/purchase-orders" },
  { kind: "item", key: "grn", label: "Goods receipts", icon: "truck", href: "/procurement/grns" },
  { kind: "item", key: "bills", label: "Vendor bills", icon: "invoice", href: "/procurement/vendor-bills" },

  { kind: "sep", label: "After-sales" },
  { kind: "item", key: "service", label: "Service dashboard", icon: "report", href: "/service" },
  { kind: "item", key: "service-issues", label: "Service tickets", icon: "clock", href: "/service/issues" },
  { kind: "item", key: "amcs", label: "AMC contracts", icon: "folder", href: "/amcs" },

  { kind: "sep", label: "Admin" },
  { kind: "item", key: "users", label: "Users & roles", icon: "user", href: "/admin/users" },
  { kind: "item", key: "rates", label: "Wage rates", icon: "pie", href: "/admin/rates" },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  footer?: ReactNode;
}

export function Sidebar({ userName, userRole, footer }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname() ?? "/dashboard";

  const initials = userName
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const width = collapsed ? 60 : 236;

  return (
    <aside
      // Positioning is handled by DashboardShell (sticky on desktop, fixed
      // off-screen drawer on mobile). The aside itself only needs to fill
      // its container vertically and own its own width.
      style={{
        width,
        flex: "none",
        background: SAB.card,
        borderRight: `1px solid ${SAB.rule}`,
        display: "flex",
        flexDirection: "column",
        transition: "width .15s",
        height: "100vh",
      }}
    >
      <div
        style={{
          padding: collapsed ? "16px 12px" : "16px 18px",
          borderBottom: `1px solid ${SAB.rule}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {collapsed ? (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: SAB.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 40 40">
              <path
                d="M11 25c0-4 3-6 7-6s7-2 7-6"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="11" cy="15" r="2.2" fill="#fff" />
              <circle cx="29" cy="25" r="2.2" fill="#fff" />
            </svg>
          </div>
        ) : (
          <Link href="/dashboard" style={{ textDecoration: "none" }}>
            <Wordmark size={14} />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: SAB.ink3,
            padding: 4,
            display: collapsed ? "none" : "flex",
          }}
        >
          <Icon name="menu" size={14} />
        </button>
      </div>

      {!collapsed && (
        <div style={{ padding: "12px 12px 8px" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 10, top: 9, color: SAB.ink3 }}>
              <Icon name="search" size={13} />
            </div>
            <input
              placeholder="Search or jump to…"
              style={{
                width: "100%",
                padding: "7px 10px 7px 30px",
                borderRadius: 4,
                border: `1px solid ${SAB.rule}`,
                background: SAB.paperAlt,
                fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
                fontSize: 12,
                color: SAB.ink,
                outline: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: 8,
                top: 7,
                fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                fontSize: 10,
                color: SAB.ink3,
                padding: "1px 5px",
                border: `1px solid ${SAB.rule}`,
                borderRadius: 3,
              }}
            >
              ⌘K
            </div>
          </div>
        </div>
      )}

      <nav style={{ flex: 1, overflowY: "auto", padding: "4px 8px 12px" }}>
        {NAV.map((n, i) => {
          if (n.kind === "sep") {
            return !collapsed ? (
              <div
                key={`sep-${i}`}
                style={{
                  fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                  fontSize: 9.5,
                  color: SAB.ink3,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  padding: "14px 10px 6px",
                }}
              >
                {n.label}
              </div>
            ) : (
              <div key={`sep-${i}`} style={{ height: 12 }} />
            );
          }

          const active =
            pathname === n.href ||
            (n.href !== "/dashboard" && pathname.startsWith(n.href));

          return (
            <Link
              key={n.key}
              href={n.href}
              title={collapsed ? n.label : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: collapsed ? "8px 9px" : "7px 10px",
                fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                color: active ? SAB.accentInk : SAB.ink2,
                background: active ? SAB.accentWash : "transparent",
                border: "none",
                borderRadius: 4,
                textDecoration: "none",
                textAlign: "left",
                marginBottom: 1,
                borderLeft: active ? `2px solid ${SAB.accent}` : "2px solid transparent",
              }}
            >
              <Icon name={n.icon} size={15} />
              {!collapsed && (
                <>
                  <span style={{ flex: 1 }}>{n.label}</span>
                  {n.count !== undefined && (
                    <span
                      style={{
                        fontFamily: "var(--font-sab-mono), ui-monospace, monospace",
                        fontSize: 10,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: n.badge ? SAB.accent : SAB.paperAlt,
                        color: n.badge ? "#fff" : SAB.ink3,
                      }}
                    >
                      {n.count}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div
          style={{
            padding: 12,
            borderTop: `1px solid ${SAB.rule}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              background: SAB.accent,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-sab-sans), Inter Tight, system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 600,
                color: SAB.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {userName}
            </div>
            <div
              className="sab-caps"
              style={{ fontSize: 9.5, letterSpacing: ".08em" }}
            >
              {userRole} · FY 25-26
            </div>
          </div>
          {footer}
        </div>
      )}
    </aside>
  );
}
