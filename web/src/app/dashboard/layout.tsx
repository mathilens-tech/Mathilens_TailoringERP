"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { isAuthenticated, clearTokens, getAccessToken } from "@/lib/auth";
import { getBusinessMode, type BusinessMode } from "@/lib/api/business-mode";
import { useBranding } from "@/lib/use-branding";
import { usePermissions } from "@/lib/use-permissions";
import { PERMISSIONS, displayNameOf } from "@/lib/api/users";
import { Modal } from "@/components/ui/Modal";
import { ChangePasswordForm } from "@/components/users/ChangePasswordForm";
import { getUserPhoto, initialsFor } from "@/lib/api/user-profile";

/**
 * A single navigable screen.
 *
 * `permission: null` means everyone signed in may see it. `role` is a second, narrower gate for the
 * few screens where no permission expresses the rule — Advanced settings is Owner-only because the
 * permission that would cover it, Settings.Manage, is also held by Managers.
 */
type NavLeaf = {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  permission: string | null;
  role?: string;
  /**
   * A third gate, for the screens that only exist in a shop that sells cloth. A tailoring-only shop
   * has no fabric to sell, so offering it "Fabric Only" would lead to a screen that bounces it
   * straight back — the same rule OrderKindScreen enforces on arrival, applied one step earlier so
   * the menu never shows a door that does not open.
   */
  requiresFabricTrade?: boolean;
};

/** A heading that expands to reveal its children. Groups never navigate anywhere themselves. */
type NavGroup = {
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  children: NavLeaf[];
};

type NavEntry = NavLeaf | NavGroup;

const isGroup = (entry: NavEntry): entry is NavGroup => "children" in entry;

/**
 * The nav, in the order the shop asked for.
 *
 * Branding is deliberately absent. The feature is not removed — the shop name, logo and colour it
 * stores are still applied on every screen and on invoices, and /dashboard/branding still answers —
 * it is simply not on offer yet, so it is not in the menu.
 */
const NAV_ITEMS: NavEntry[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, permission: null },
  {
    // The three kinds of order the shop writes, each on the menu rather than behind a chooser the
    // staff had to pass through first. The kind is the question the counter answers before anything
    // else, so it belongs where the work starts.
    //
    // "All Orders" leads the group and is not optional: the list is what the menu item used to be,
    // and losing it to make room for the new screens would be a poor trade.
    label: "Orders",
    icon: OrdersIcon,
    children: [
      { href: "/dashboard/orders", label: "All Orders", icon: OrdersIcon, permission: PERMISSIONS.ordersView },
      {
        href: "/dashboard/orders/new/fabric",
        label: "Fabric Only",
        icon: FabricIcon,
        permission: PERMISSIONS.ordersCreate,
        requiresFabricTrade: true,
      },
      {
        href: "/dashboard/orders/new/fabric-tailoring",
        label: "Fabric + Tailoring",
        icon: GarmentIcon,
        permission: PERMISSIONS.ordersCreate,
        requiresFabricTrade: true,
      },
      {
        href: "/dashboard/orders/new/tailoring",
        label: "Tailoring",
        icon: ScissorsIcon,
        permission: PERMISSIONS.ordersCreate,
      },
    ],
  },
  { href: "/dashboard/customers", label: "Customers", icon: CustomersIcon, permission: PERMISSIONS.customersView },
  { href: "/dashboard/invoices", label: "Invoices", icon: InvoicesIcon, permission: PERMISSIONS.invoicesView },
  {
    label: "Inventory",
    icon: InventoryIcon,
    children: [
      { href: "/dashboard/price-detail", label: "Fabric Details", icon: PriceDetailIcon, permission: PERMISSIONS.pricingView },
      // "Inventory Transaction", not "Inventory": a child sharing its parent's name told the reader
      // nothing, and what the screen records is cloth moving in.
      { href: "/dashboard/inventory", label: "Inventory Transaction", icon: ReceiptIcon, permission: PERMISSIONS.inventoryView },
      { href: "/dashboard/stock", label: "Stock Details", icon: StockIcon, permission: PERMISSIONS.inventoryView },
    ],
  },
  {
    label: "Reports",
    icon: ReportsIcon,
    children: [
      // One word each. Sitting under a "Reports" heading, "Birthday Report" said Report twice, and
      // the longer names were what pushed the rail wider than the labels needed.
      { href: "/dashboard/reports/order-collections", label: "Orders", icon: ReportsIcon, permission: PERMISSIONS.reportsView },
      { href: "/dashboard/reports/revenue", label: "Revenue", icon: RevenueIcon, permission: PERMISSIONS.reportsView },
      { href: "/dashboard/reports/order-status", label: "Order Status", icon: OrdersIcon, permission: PERMISSIONS.reportsView },
      { href: "/dashboard/reports/outstanding-invoices", label: "Invoice", icon: InvoicesIcon, permission: PERMISSIONS.reportsView },
      { href: "/dashboard/reports/birthday", label: "Birthday", icon: CakeIcon, permission: PERMISSIONS.reportsView },
      { href: "/dashboard/reports/wedding", label: "Wedding", icon: RingsIcon, permission: PERMISSIONS.reportsView },
    ],
  },
  // WhatsApp is off the menu. The way the shop actually messages a customer is Share via WhatsApp
  // on the order and the invoice — the shop's own phone, the shop pressing Send — and a menu item
  // leading to a list of provider-sent messages offered a second, unused way in. The routes still
  // answer, so a bookmark to /dashboard/whatsapp keeps working, and none of the sharing changes.
  {
    label: "User Management",
    icon: UsersIcon,
    children: [
      { href: "/dashboard/employees", label: "Employees", icon: EmployeesIcon, permission: PERMISSIONS.employeesView },
      { href: "/dashboard/users", label: "Users", icon: UsersIcon, permission: PERMISSIONS.usersView },
      // Which roles exist, as against what each one may do — two separate rights, because adding a
      // role is harmless on its own and granting it rights is not.
      { href: "/dashboard/user-roles", label: "User Role", icon: RoleIcon, permission: PERMISSIONS.usersRoles },
      // Users.Rights, matching the API: the role-permission endpoints are guarded by it so that a
      // Manager holding Settings.Manage cannot grant themselves the right to hand out access.
      { href: "/dashboard/user-rights", label: "User Rights", icon: ShieldIcon, permission: PERMISSIONS.usersRights },
      { href: "/dashboard/activity", label: "Activity Log", icon: ActivityIcon, permission: PERMISSIONS.activityView },
    ],
  },
  {
    label: "Settings",
    icon: SettingsIcon,
    children: [
      // First, because it decides what the New Order screen asks for at all — every setting below
      // it is a detail within the trade this one names.
      { href: "/dashboard/settings/business-mode", label: "Business Mode", icon: ShopIcon, permission: PERMISSIONS.settingsView },
      { href: "/dashboard/settings/order-duration", label: "Order Duration", icon: ClockIcon, permission: PERMISSIONS.settingsView },
      // Sits next to Order Duration because the two decide the same thing between them: how far
      // ahead a collection date is pre-filled, and which days it is allowed to land on.
      { href: "/dashboard/settings/working-days", label: "Working Days", icon: CalendarIcon, permission: PERMISSIONS.settingsView },
      // Ahead of Tailoring Cost because it decides what that screen has rows for: the garment list
      // is the master, the price is a column against it.
      { href: "/dashboard/settings/garments", label: "Garments", icon: GarmentIcon, permission: PERMISSIONS.settingsView },
      // Beside Measurement, since both are per-garment settings the New Order screen reads.
      { href: "/dashboard/settings/tailoring-cost", label: "Tailoring Cost", icon: ScissorsIcon, permission: PERMISSIONS.settingsView },
      { href: "/dashboard/settings/order-number", label: "Order Number", icon: HashIcon, permission: PERMISSIONS.settingsView },
      { href: "/dashboard/settings/invoice", label: "Invoice Settings", icon: InvoicesIcon, permission: PERMISSIONS.settingsView },
      { href: "/dashboard/settings/measurement-templates", label: "Measurement", icon: RulerIcon, permission: PERMISSIONS.settingsView },
      // No permission at all: Front Desk and Tailor hold no Settings.View, and the theme toggle no
      // longer sits in the header, so gating this would leave them unable to change it anywhere.
      { href: "/dashboard/settings/appearance", label: "Appearance", icon: ThemeIcon, permission: null },
      // Change Password is off this menu: it is the one thing here that changes the person rather
      // than the shop, and it is reached from the profile menu at the foot of this rail instead.
      // The route still answers, so a bookmark to it keeps working.
      // Advanced is off the menu — the raw settings store is not something the shop uses. The route
      // still answers for the rare case a value needs changing before it has a proper editor.
    ],
  },
];

/**
 * The dashboard shell: left nav rail + header + content area (00_MASTER_SPEC.md § 9.6 Page
 * Layout Standards). Operational widgets arrive as their modules are built — this is
 * intentionally just the shell for Phase 1 (docs/03_ROADMAP.md).
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  // Two separate pieces of state because the toggle means two different things by screen size:
  // on a phone or tablet the nav is a drawer that slides over the content, on a desktop it is a
  // rail that shrinks to icons. One shared boolean would either open the drawer by default on
  // mobile or collapse the desktop rail by default — both wrong.
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Which groups the user has opened by hand. A group holding the current page is always shown open
  // regardless, so this only records deliberate opening and closing — it starts empty rather than
  // pre-seeded, which would fight the auto-open below on the very first render.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [photo, setPhoto] = useState<string | null>(null);
  // Null until the shop's trade has been read. The fabric entries stay hidden meanwhile, which is
  // the same way round OrderKindScreen fails: a shop that has not said it sells cloth is treated as
  // one that does not, rather than being shown two screens it may not be able to use.
  const [businessMode, setBusinessMode] = useState<BusinessMode | null>(null);
  // Also applies the shop's colour to the theme's CSS variables, which is why it lives in the
  // shell rather than on the Branding page — every screen inside gets it.
  const branding = useBranding();
  const { user, isLoaded: permissionsLoaded, can } = usePermissions();

  useEffect(() => {
    // Deliberately not `useSyncExternalStore`: this value has no valid server snapshot
    // (there is no cookie/session on the server to check), so treating it as one forces a
    // render with `authenticated=false` on the client's first paint too, and a redirect effect
    // keyed off that value fires before the real client check ever lands — a flash-redirect to
    // /login even when the user has a valid token. A one-time mount check avoids that race.
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChecked(true);
  }, [router]);

  useEffect(() => {
    // Read once for the whole shell rather than per screen — the menu needs it on every page, and
    // it is a single settings row that does not change while someone is working. Never rejects.
    if (!checked) {
      return;
    }
    let cancelled = false;
    getBusinessMode(getAccessToken()).then((mode) => {
      if (!cancelled) {
        setBusinessMode(mode);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [checked]);

  useEffect(() => {
    // The signed-in person's own picture, for the rail. Silent on failure: an avatar that cannot be
    // read falls back to initials, which is not worth an error anywhere on screen.
    if (!user?.id) {
      return;
    }
    let cancelled = false;
    getUserPhoto(user.id, getAccessToken()).then((stored) => {
      if (!cancelled) {
        setPhoto(stored);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function handleLogout() {
    clearTokens();
    router.replace("/login");
  }

  if (!checked) {
    return null;
  }

  const roles = user?.roles ?? [];
  const allows = (leaf: NavLeaf) =>
    (leaf.permission === null || can(leaf.permission)) &&
    (leaf.role === undefined || roles.includes(leaf.role)) &&
    (leaf.requiresFabricTrade !== true || businessMode === "tailoringFabric");

  // A group survives only if at least one of its children does, so nobody is offered a heading that
  // opens onto nothing. The children are filtered too, not just counted — a Manager's User
  // Management holds Employees, Users and Activity Log, but not User Rights.
  const navItems: NavEntry[] = permissionsLoaded
    ? NAV_ITEMS.flatMap((entry): NavEntry[] => {
        if (!isGroup(entry)) {
          return allows(entry) ? [entry] : [];
        }
        const children = entry.children.filter(allows);
        return children.length > 0 ? [{ ...entry, children }] : [];
      })
    : [];

  // The most specific entry wins, and only it. Prefix-matching each href independently was fine
  // while no nav item sat underneath another, but "/dashboard/orders/new/tailoring" is under
  // "/dashboard/orders" — matched independently, both would light up, and the rail would claim you
  // were in two places. Longest match also retires the special case Dashboard needed, since
  // "/dashboard" now only wins when nothing longer matches.
  const activeHref = NAV_ITEMS.flatMap((entry) => (isGroup(entry) ? entry.children : [entry]))
    .map((leaf) => leaf.href)
    .filter((href) => pathname === href || (pathname?.startsWith(`${href}/`) ?? false))
    .sort((a, b) => b.length - a.length)[0];

  const isCurrent = (href: string) => activeHref === href;

  // Below lg the rail is off-canvas, so a control placed inside it would be unreachable precisely
  // when it is needed — this button is the only way back to the nav, which is why it survives the
  // header being gone. The desktop collapse toggle has no such problem and sits in the rail itself,
  // next to the shop name.
  const drawerToggle = (
    <button
      type="button"
      onClick={() => setIsDrawerOpen(true)}
      aria-label="Open navigation"
      className="-ml-2 rounded-md p-2 text-foreground/65 transition-colors hover:bg-surface-hover hover:text-foreground lg:hidden"
    >
      <MenuIcon className="h-5 w-5" />
    </button>
  );

  return (
    <div className="flex min-h-full flex-1">
      {/* Backdrop for the small-screen drawer. Tapping it closes the nav, as a drawer should. */}
      {isDrawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}
      {/* On desktop the rail is stuck to the viewport and exactly its height, so a nav longer than
          the window scrolls inside its own nav rather than making the whole page taller. As a plain
          static column it stretched to its content, and expanding a group put a scrollbar on screens
          whose content fit comfortably. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-border bg-surface transition-[transform,width] duration-200 lg:sticky lg:bottom-auto lg:top-0 lg:h-dvh lg:translate-x-0 lg:self-start print:hidden ${
          isDrawerOpen ? "w-60 translate-x-0" : "w-60 -translate-x-full"
        } ${isCollapsed ? "lg:w-16" : "lg:w-60"}`}
      >
        {/* Brand row doubles as the collapse control's home. Collapsed, the rail is only 4rem wide
            — too narrow for a mark and the button side by side — so the two stack instead of the
            brand stepping aside entirely: the shop is still identifiable at a glance, and the
            toggle stays put directly beneath it as the affordance for expanding again. */}
        {/* px-20, not px-5: the nav below indents its icons 24px from the rail edge (px-3 on the
            list, px-3 again on each row), so at 20px the logo started 4px further left than every
            item under it and the rail had no single left edge. 24px puts the logo on that same
            line. Overridden by lg:px-2 when collapsed, where the mark is centred instead. */}
        <div
          className={`flex items-center gap-2 border-b border-border px-6 py-4 ${
            isCollapsed ? "lg:flex-col lg:justify-center lg:gap-1 lg:px-2" : ""
          }`}
        >
          <Link
            href="/dashboard"
            className={`flex min-w-0 items-center gap-2.5 whitespace-nowrap text-sm font-semibold ${
              isCollapsed ? "lg:justify-center" : "flex-1"
            }`}
          >
            {/* Three ways this header can be branded, in order of what a shop has actually given us.
                A logo set in Settings › Branding still wins — it is the per-shop escape hatch and
                predates this — but it is a URL pointing at a square badge, so it keeps the badge
                treatment and the name beside it.

                Failing that, the shipped wordmark. It carries the shop's name inside the artwork,
                so the text beside it is dropped: printing "Radha Fabric" next to a logo that
                already reads RADHA FABRIC & TAILORING says it twice. The square R stands in when
                the rail is collapsed, where a 2:1 lockup would shrink to an illegible smudge.

                Failing both, the initial in a blue tile, exactly as before. */}
            {branding.logoUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- an arbitrary shop-supplied URL can't be known to next/image at build time */}
                <img src={branding.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" />
                <span className={isCollapsed ? "lg:hidden" : ""}>{branding.shopName || "Mathilens ERP"}</span>
              </>
            ) : (
              <>
                {/* h-7 — 28px, rendering 86x28.

                    Sized against the artwork as it is now, which is the whole RADHA lockup and
                    nothing else. It is trimmed hard to the ink and carries no white margin of its
                    own, so this height is the height of the lettering itself; when the strapline
                    was still part of the file the same number covered three stacked bands, and
                    dropping it made the letterforms half again as tall at an unchanged h-8.

                    28px against the 36px toggle beside it, which is what sets the header's height,
                    leaves 20px above and below the logo and 24px to the rail's left edge — even
                    enough to read as deliberate, and the nav below it has not moved.

                    w-auto keeps the 3.06:1 ratio: height is the only dimension set, so nothing can
                    stretch or crop. max-w is a guard rather than a size — the row has 148px for the
                    logo once the toggle and the gap are taken out, and 86px never reaches it. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- a plain public asset; next/image would add a loader for no benefit at this size */}
                <img
                  src="/logo.png"
                  alt={branding.shopName || "Radha Fabric"}
                  className={`h-7 w-auto max-w-[9rem] shrink-0 object-contain ${isCollapsed ? "lg:hidden" : ""}`}
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- as above */}
                <img
                  src="/logo-mark.png"
                  alt=""
                  aria-hidden="true"
                  className={`h-7 w-7 shrink-0 object-contain ${isCollapsed ? "hidden lg:block" : "hidden"}`}
                />
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            aria-pressed={isCollapsed}
            title={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="hidden shrink-0 rounded-md p-2 text-foreground/65 transition-colors hover:bg-surface-hover hover:text-foreground lg:block"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4 text-sm">
          {/* Nothing is shown until /me has answered — briefly rendering links the user turns out
              not to have would be worse than a moment of an empty rail. */}
          {navItems.map((entry) => {
            if (!isGroup(entry)) {
              return (
                <NavLink
                  key={entry.href}
                  leaf={entry}
                  isActive={isCurrent(entry.href)}
                  isCollapsed={isCollapsed}
                  onNavigate={() => setIsDrawerOpen(false)}
                />
              );
            }

            const holdsCurrentPage = entry.children.some((child) => isCurrent(child.href));
            // Open when it holds the page you are on, whatever you last clicked — otherwise landing
            // on Stock Details by link would leave its own group shut around it.
            const isOpen = openGroups[entry.label] ?? holdsCurrentPage;
            const GroupIcon = entry.icon;

            return (
              <div key={entry.label} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    // Collapsed, the labels are hidden, so opening a group in place would reveal a
                    // list of nameless icons. Expand the rail first and open the group with it.
                    if (isCollapsed) {
                      setIsCollapsed(false);
                      setOpenGroups((open) => ({ ...open, [entry.label]: true }));
                      return;
                    }
                    setOpenGroups((open) => ({ ...open, [entry.label]: !isOpen }));
                  }}
                  aria-expanded={isCollapsed ? false : isOpen}
                  title={isCollapsed ? entry.label : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                    holdsCurrentPage
                      ? "font-medium text-foreground"
                      : "text-foreground/65 hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  <GroupIcon className="h-4 w-4 shrink-0" />
                  <span className={`flex-1 ${isCollapsed ? "lg:hidden" : ""}`}>{entry.label}</span>
                  <ChevronIcon
                    className={`h-3.5 w-3.5 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""} ${
                      isCollapsed ? "lg:hidden" : ""
                    }`}
                  />
                </button>

                {isOpen && !isCollapsed && (
                  // Indented and ruled, so a child reads as belonging to the heading above it
                  // rather than as another top-level entry that happens to be lower down.
                  <div className="ml-5 flex flex-col gap-0.5 border-l border-border pl-2">
                    {entry.children.map((child) => (
                      <NavLink
                        key={child.href}
                        leaf={child}
                        isActive={isCurrent(child.href)}
                        isCollapsed={false}
                        onNavigate={() => setIsDrawerOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-border px-3 py-3">
          <ProfileMenu
            name={user ? displayNameOf(user) : null}
            email={user?.email ?? null}
            photo={photo}
            isCollapsed={isCollapsed}
            onNavigate={() => setIsDrawerOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      </aside>
      <div className="flex min-h-full flex-1 flex-col">
        {/*
          No header bar. It carried a breadcrumb repeating the heading each page already prints, and
          an appearance toggle that now lives in Settings — the one control that could not go is the
          drawer opener, so it stays on its own.

          Small screens only: on a desktop the rail is always on-screen and carries its own collapse
          toggle, so this would be an empty strip of padding above the page heading.
        */}
        <div className="flex shrink-0 items-center px-4 pt-4 print:hidden sm:px-6 lg:hidden">{drawerToggle}</div>
        {/* min-w-0 so a wide child inside can shrink rather than stretching the flex row and
            handing the page a sideways scrollbar. Narrower gutters on a phone, where six wasted
            rems is most of a column. */}
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}

/** One nav row. Shared by top-level entries and group children, which differ only in indentation. */
function NavLink({
  leaf,
  isActive,
  isCollapsed,
  onNavigate,
}: {
  leaf: NavLeaf;
  isActive: boolean;
  isCollapsed: boolean;
  onNavigate: () => void;
}) {
  const Icon = leaf.icon;
  return (
    <Link
      href={leaf.href}
      // Navigating on a phone should get the drawer out of the way, not leave it covering the page
      // the user just asked for.
      onClick={onNavigate}
      title={isCollapsed ? leaf.label : undefined}
      className={`flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-foreground/65 hover:bg-surface-hover hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={isCollapsed ? "lg:hidden" : ""}>{leaf.label}</span>
    </Link>
  );
}

/**
 * The signed-in person, at the foot of the rail.
 *
 * A button rather than a link: the two things wanted here are their profile and the way out, and
 * putting Sign out one deliberate step behind the avatar is what stops it being pressed by someone
 * reaching for the last nav row above it.
 */
function ProfileMenu({
  name,
  email,
  photo,
  isCollapsed,
  onNavigate,
  onLogout,
}: {
  /** Already fallen back to the email where the account has no name — see displayNameOf. */
  name: string | null;
  email: string | null;
  photo: string | null;
  isCollapsed: boolean;
  onNavigate: () => void;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Clicking anywhere else closes it, as a menu opened by a click should.
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const avatar = photo ? (
    // A plain img, not next/image: a data URI has nothing for the image optimiser to fetch.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photo} alt="" className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
  ) : (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-hover text-xs font-semibold text-foreground/60"
    >
      {initialsFor(name)}
    </span>
  );

  // Dropped when there is no name, because `name` is then the email already and the rail is too
  // narrow to print it twice.
  const showEmailUnderName = Boolean(email) && name !== email;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={isCollapsed ? name ?? "Profile" : undefined}
        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-foreground/70 transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        {avatar}
        {/* Name over email, the pairing every account menu uses: the name is who you are, the
            address is only how you got in. Both truncate — the rail is 240px and neither is
            allowed to widen it. */}
        <span className={`flex min-w-0 flex-1 flex-col text-left ${isCollapsed ? "lg:hidden" : ""}`}>
          <span className="truncate">{name ?? "Profile"}</span>
          {showEmailUnderName && <span className="truncate text-xs text-foreground/50">{email}</span>}
        </span>
        <ChevronIcon className={`h-3.5 w-3.5 shrink-0 -rotate-90 ${isCollapsed ? "lg:hidden" : ""}`} />
      </button>

      {isOpen && (
        // Opens upward — it is the last thing in the rail, so there is nothing below it to open into.
        <div
          role="menu"
          className="absolute bottom-full left-0 z-50 mb-1 w-full min-w-44 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          <Link
            href="/dashboard/profile"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onNavigate();
            }}
            className="flex items-center gap-3 px-3 py-2 text-sm text-foreground/70 transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <ProfileIcon className="h-4 w-4 shrink-0" />
            View profile
          </Link>
          {/* Opens in place rather than navigating: changing a password is a short form with
              nothing on the page around it, and leaving the screen you were on to do it means
              finding your way back afterwards. Above Sign out, which this menu must never put
              anything below. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              setIsChangingPassword(true);
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-foreground/70 transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <KeyIcon className="h-4 w-4 shrink-0" />
            Change password
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-foreground/70 transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <LogoutIcon className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      )}

      {/* Outside the menu, so dismissing the menu does not take the dialog with it. */}
      <Modal open={isChangingPassword} title="Change Password" onClose={() => setIsChangingPassword(false)}>
        <ChangePasswordForm onDone={() => setIsChangingPassword(false)} />
      </Modal>
    </div>
  );
}

type IconProps = { className?: string };

/** Head and shoulders — the person signed in, as opposed to the Users screen's crowd. */
function ProfileIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function RevenueIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 17l5-5 4 3 6-7" />
      <path d="M15 8h4v4" />
    </svg>
  );
}

/** A cake with a candle — a birthday needs no more explanation than that. */
function CakeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h16v-6a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v6Z" />
      <path d="M4 16c1.5 1.2 3 1.2 4.5 0S11.5 14.8 13 16s3 1.2 4.5 0" />
      <path d="M12 8V5" />
      <circle cx="12" cy="3.5" r="1" />
    </svg>
  );
}

/** Two interlocking rings. */
function RingsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="9" cy="14" r="6" />
      <circle cx="15" cy="14" r="6" />
    </svg>
  );
}

function KeyIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3M15.5 12v2" />
    </svg>
  );
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** A docket — what a delivery of cloth is recorded on. */
function ReceiptIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v18l2.5-1.6L10 21l2-1.6L14 21l2.5-1.6L19 21V3H5Z" />
      <path d="M9 8h6M9 12h6" />
    </svg>
  );
}

/** A name badge — a role is the label a person wears, not the person. */
function RoleIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2" />
      <path d="M5 16c.6-1.5 2-2.2 3.5-2.2S11.4 14.5 12 16M14.5 10h4.5M14.5 13.5h3" />
    </svg>
  );
}

function ShieldIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v6c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function HashIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

function ClockIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

/** Tailor's shears — what the shop charges for the cutting and stitching. */
function ScissorsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.5 20 18M20 6 8 16.5" />
    </svg>
  );
}

/** A shopfront under its awning — what the shop trades in, as opposed to any one order. */
function ShopIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9h18l-1.5-5h-15L3 9Z" />
      <path d="M4.5 9v11h15V9" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

/**
 * A bolt of cloth with a cut edge — cloth as the thing being sold, which is what separates a fabric
 * order from the shirt (a garment) and the shears (stitching) beside it in the menu.
 */
function FabricIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h13a3 3 0 0 1 0 6H3V6Z" />
      <path d="M3 12v6h13a3 3 0 0 0 3-3" />
      <path d="M16 6v6" />
    </svg>
  );
}

/** A shirt on its hanger — the garment list itself, as opposed to the shears that price it. */
function GarmentIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4a3 3 0 0 0 6 0" />
      <path d="M9 4 4 7l2 3 2-1v10h8V9l2 1 2-3-5-3" />
    </svg>
  );
}

/** Month grid with its hanging rings — working days and holidays. */
function CalendarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function RulerIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="8" width="20" height="8" rx="1.5" />
      <path d="M7 8v3M12 8v4M17 8v3" />
    </svg>
  );
}

/** Half-lit disc — the usual shorthand for a light/dark choice. */
function ThemeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ActivityIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function MenuIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function CustomersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M17 12.5c2.5.3 4.5 2.6 4.5 5.5" />
    </svg>
  );
}

function EmployeesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="4" y="7" width="16" height="13" rx="1.5" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

function OrdersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M6 3h12l1 5H5l1-5Z" />
      <path d="M4 8h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8Z" />
      <path d="M9 11a3 3 0 0 0 6 0" />
    </svg>
  );
}

function InvoicesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M6 2h9l3 3v17H6V2Z" />
      <path d="M15 2v3h3" />
      <path d="M9 12h6M9 16h6M9 8h3" />
    </svg>
  );
}

function ReportsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" />
      <rect x="12" y="8" width="3" height="10" />
      <rect x="17" y="5" width="3" height="13" />
    </svg>
  );
}

function PriceDetailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M12 3h6a2 2 0 0 1 2 2v6l-9.3 9.3a1 1 0 0 1-1.4 0L3 14a1 1 0 0 1 0-1.4L12 3Z" />
      <circle cx="16.5" cy="7.5" r="1.5" />
    </svg>
  );
}

/** A stack of folded bolts of cloth — inventory here means what is on the shelf, not a warehouse. */
function InventoryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="5" rx="1" />
      <rect x="3" y="10" width="18" height="5" rx="1" />
      <rect x="3" y="16" width="18" height="4" rx="1" />
      <path d="M8 4v5M14 10v5" />
    </svg>
  );
}

/** Bars at differing heights — a quantity per item, which is what this screen is. */
function StockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 21h18" />
      <rect x="5" y="12" width="4" height="6" rx="1" />
      <rect x="11" y="8" width="4" height="10" rx="1" />
      <rect x="17" y="14" width="4" height="4" rx="1" />
    </svg>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
