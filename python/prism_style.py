"""
prism_style.py — GraphPad-Prism-style publication figures in matplotlib.

This is the Python counterpart of the TypeScript SVG engine in `src/plot.ts`.
It mirrors the same visual language so a figure exported from the web app and
one produced here look like siblings:

  * white background, no grid, only the left + bottom spines (Prism look)
  * black axis lines and outward ticks, bold axis labels, sans-serif
  * the Wong colour-blind-safe palette (identical to the app's PALETTE)
  * PDF/SVG saved with editable text for Illustrator / Inkscape

No seaborn, no heavy colours. Drop your own arrays into the example functions
at the bottom (or import the helpers) and you get manuscript-ready panels.

Run directly to regenerate the demo figure::

    python python/prism_style.py
"""

from __future__ import annotations

from typing import Iterable, Sequence

import matplotlib

matplotlib.use("Agg")  # headless; safe for CI / servers. Remove for interactive use.

import matplotlib.pyplot as plt
import numpy as np

# ---------------------------------------------------------------------------
# Palette — identical to the app's PALETTE (Wong, colour-blind safe).
# Use ACCENT for the optional "second group" in line plots.
# ---------------------------------------------------------------------------

PALETTE = [
    "#0072B2",  # blue
    "#E69F00",  # orange
    "#009E73",  # green
    "#CC79A7",  # pink
    "#D55E00",  # vermillion
    "#56B4E9",  # sky blue
    "#999999",  # grey
    "#000000",  # black
]

INK = "#000000"          # axis lines, ticks, text (Prism uses near-black)
ACCENT = "#0072B2"       # dark blue accent for a second line-plot group
BOX_FILL = "#e8eaed"     # light grey box / bar fill
BAR_FILL = "#bdbdbd"     # medium grey bars

# ---------------------------------------------------------------------------
# 1. Global rcParams — set once on import.
# ---------------------------------------------------------------------------


def set_rcparams() -> None:
    """Apply the global manuscript style. Called automatically on import."""
    plt.rcParams.update(
        {
            # ---- font ----
            "font.family": "sans-serif",
            # Arial first; DejaVu Sans is the always-available fallback.
            "font.sans-serif": ["Arial", "DejaVu Sans", "Helvetica"],
            "font.size": 9,
            "axes.labelsize": 11,
            "axes.labelweight": "bold",
            "axes.titlesize": 11,
            "axes.titleweight": "bold",
            "legend.fontsize": 9,
            "xtick.labelsize": 9,
            "ytick.labelsize": 9,
            # ---- lines / spines ----
            "axes.linewidth": 1.6,          # 1.5–1.8
            "axes.edgecolor": INK,
            "lines.linewidth": 1.6,
            # ---- ticks ----
            "xtick.direction": "out",
            "ytick.direction": "out",
            "xtick.major.width": 1.4,       # 1.3–1.5
            "ytick.major.width": 1.4,
            "xtick.major.size": 4,
            "ytick.major.size": 4,
            "xtick.color": INK,
            "ytick.color": INK,
            # ---- background / grid ----
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "savefig.facecolor": "white",
            "axes.grid": False,
            # ---- export: keep text editable in Illustrator / Inkscape ----
            "savefig.dpi": 600,
            "figure.dpi": 120,
            "pdf.fonttype": 42,             # TrueType, not paths
            "ps.fonttype": 42,
            "svg.fonttype": "none",         # text stays as <text>, not outlines
            "savefig.bbox": "tight",
        }
    )


set_rcparams()


# ---------------------------------------------------------------------------
# 2. prism_style(ax) — the core per-axes styler.
# ---------------------------------------------------------------------------


def prism_style(ax: plt.Axes, *, linewidth: float = 1.6) -> plt.Axes:
    """Apply the Prism look to a single Axes.

    Hides the top/right spines, thickens the left/bottom spines, points ticks
    outward, and disables the grid. Returns the axes for chaining.
    """
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_visible(True)
        ax.spines[side].set_linewidth(linewidth)
        ax.spines[side].set_color(INK)
    ax.tick_params(
        direction="out",
        width=1.4,
        length=4,
        color=INK,
        top=False,
        right=False,
    )
    ax.grid(False)
    # Only draw ticks where there's a spine.
    ax.xaxis.set_ticks_position("bottom")
    ax.yaxis.set_ticks_position("left")
    return ax


# ---------------------------------------------------------------------------
# Small helpers: panel labels, significance bars, jitter.
# ---------------------------------------------------------------------------


def add_panel_label(ax: plt.Axes, label: str, *, size: int = 15) -> None:
    """Bold panel label (e.g. "(C)") just outside the upper-left corner."""
    ax.annotate(
        label,
        xy=(0.0, 1.0),
        xycoords="axes fraction",
        xytext=(-36, 14),
        textcoords="offset points",
        fontsize=size,
        fontweight="bold",
        va="bottom",
        ha="left",
        annotation_clip=False,
    )


def add_sig_bar(
    ax: plt.Axes,
    x1: float,
    x2: float,
    y: float,
    label: str = "***",
    *,
    tick: float | None = None,
    linewidth: float = 1.4,
    fontsize: int = 12,
) -> None:
    """Draw a significance bracket between x1 and x2 at height y with `label`.

    `tick` is the downward end-cap length in data units; if omitted it scales
    to ~2% of the current y-range.
    """
    if tick is None:
        lo, hi = ax.get_ylim()
        tick = (hi - lo) * 0.02
    ax.plot(
        [x1, x1, x2, x2],
        [y - tick, y, y, y - tick],
        lw=linewidth,
        color=INK,
        clip_on=False,
        solid_capstyle="butt",
    )
    ns = label.strip().lower() in ("ns", "n.s.")
    ax.text(
        (x1 + x2) / 2,
        y,
        label,
        ha="center",
        va="bottom",
        fontsize=fontsize if not ns else fontsize - 2,
        fontstyle="italic" if ns else "normal",
        fontweight="normal" if ns else "bold",
        color=INK,
    )


def _jitter(n: int, center: float, width: float = 0.08, seed: int | None = 0) -> np.ndarray:
    """Reproducible horizontal jitter around `center` for n points."""
    rng = np.random.default_rng(seed if seed is not None else None)
    return center + rng.uniform(-width, width, size=n)


def save_figure(fig: plt.Figure, stem: str, *, dpi: int = 600) -> None:
    """Save a figure as PDF, SVG, and PNG (all at `dpi`) with editable text."""
    for ext in ("pdf", "svg", "png"):
        fig.savefig(f"{stem}.{ext}", dpi=dpi, bbox_inches="tight")


# ---------------------------------------------------------------------------
# 3a. Boxplot with individual data points.
# ---------------------------------------------------------------------------


def boxplot_with_points(
    ax: plt.Axes,
    data: Sequence[Sequence[float]],
    labels: Sequence[str],
    *,
    ylabel: str = "% Cell Recovery",
    rotate_xticks: float = 0.0,
    sig: Sequence[tuple[int, int, str]] | None = None,
    point_size: float = 18.0,
    seed: int | None = 0,
) -> plt.Axes:
    """Light-grey boxes, black edges/median/whiskers, jittered black points.

    `data`   : one sequence of values per group.
    `sig`    : optional list of (group_i, group_j, label) significance bars,
               1-based-free (uses 0-based group indices).
    """
    prism_style(ax)
    positions = np.arange(1, len(data) + 1)

    bp = ax.boxplot(
        data,
        positions=positions,
        widths=0.55,
        patch_artist=True,
        showfliers=False,            # individual points shown instead
        medianprops=dict(color=INK, linewidth=1.6),
        boxprops=dict(facecolor=BOX_FILL, edgecolor=INK, linewidth=1.4),
        whiskerprops=dict(color=INK, linewidth=1.4),
        capprops=dict(color=INK, linewidth=1.4),
    )

    # Overlay jittered raw points.
    for pos, vals in zip(positions, data):
        vals = np.asarray(vals, dtype=float)
        ax.scatter(
            _jitter(len(vals), pos, 0.08, seed),
            vals,
            s=point_size,
            facecolor=INK,
            edgecolor="none",
            alpha=0.75,
            zorder=3,
        )

    ax.set_xticks(positions)
    ax.set_xticklabels(
        labels,
        rotation=rotate_xticks,
        ha="right" if rotate_xticks else "center",
    )
    ax.set_ylabel(ylabel)

    if sig:
        lo, hi = ax.get_ylim()
        step = (hi - lo) * 0.08
        top = max(max(np.max(v) for v in data), hi)
        for k, (i, j, lab) in enumerate(sig):
            add_sig_bar(ax, positions[i], positions[j], top + step * (k + 1), lab)
        ax.set_ylim(lo, top + step * (len(sig) + 1.5))
    return ax


# ---------------------------------------------------------------------------
# 3b. Bar plot with error bars and individual dots.
# ---------------------------------------------------------------------------


def barplot_with_points(
    ax: plt.Axes,
    data: Sequence[Sequence[float]],
    labels: Sequence[str],
    *,
    err: str = "sem",                # "sem" or "sd"
    ylabel: str = "Value",
    ylim: tuple[float, float] | None = None,
    rotate_xticks: float = 90.0,
    point_size: float = 14.0,
    seed: int | None = 0,
) -> plt.Axes:
    """Grey bars with black edges, mean ± SEM/SD caps, jittered black dots."""
    prism_style(ax)
    positions = np.arange(len(data))
    means = np.array([np.mean(v) for v in data])
    if err.lower() == "sd":
        errs = np.array([np.std(v, ddof=1) if len(v) > 1 else 0.0 for v in data])
    else:  # SEM
        errs = np.array(
            [np.std(v, ddof=1) / np.sqrt(len(v)) if len(v) > 1 else 0.0 for v in data]
        )

    ax.bar(
        positions,
        means,
        width=0.64,
        color=BAR_FILL,
        edgecolor=INK,
        linewidth=1.4,
        zorder=1,
    )
    ax.errorbar(
        positions,
        means,
        yerr=errs,
        fmt="none",
        ecolor=INK,
        elinewidth=1.4,
        capsize=3.5,
        capthick=1.4,
        zorder=2,
    )
    for pos, vals in zip(positions, data):
        vals = np.asarray(vals, dtype=float)
        ax.scatter(
            _jitter(len(vals), pos, 0.07, seed),
            vals,
            s=point_size,
            facecolor=INK,
            edgecolor="none",
            alpha=0.8,
            zorder=3,
        )

    ax.set_xticks(positions)
    ax.set_xticklabels(
        labels,
        rotation=rotate_xticks,
        ha="center" if rotate_xticks in (0, 90) else "right",
    )
    ax.set_ylabel(ylabel)
    if ylim is not None:
        ax.set_ylim(*ylim)
    return ax


# ---------------------------------------------------------------------------
# 3c. Line plot with error bars (one or two groups).
# ---------------------------------------------------------------------------


def lineplot_with_error(
    ax: plt.Axes,
    x: Sequence[float],
    groups: dict[str, dict],
    *,
    xlabel: str = "Time (h)",
    ylabel: str = "Response (a.u.)",
    annotation: str | None = None,
    annotation_xy: tuple[float, float] = (0.05, 0.92),
) -> plt.Axes:
    """Markers + lines + capped error bars for 1–2 groups.

    `groups` maps a legend label -> {"y": [...], "err": [...], "color": "#..",
    "marker": "o"}. The first group defaults to black, the second to ACCENT
    (dark blue) — keep it simple, no heavy colours.
    """
    prism_style(ax)
    default_colors = [INK, ACCENT]
    default_markers = ["o", "s"]

    for idx, (label, g) in enumerate(groups.items()):
        color = g.get("color", default_colors[idx % len(default_colors)])
        marker = g.get("marker", default_markers[idx % len(default_markers)])
        ax.errorbar(
            x,
            g["y"],
            yerr=g.get("err"),
            label=label,
            color=color,
            marker=marker,
            markersize=5,
            markerfacecolor=color,
            markeredgecolor=color,
            linewidth=1.6,
            capsize=3.5,
            capthick=1.4,
            elinewidth=1.4,
        )

    ax.set_xlabel(xlabel)
    ax.set_ylabel(ylabel)
    if len(groups) > 1:
        ax.legend(frameon=False, loc="lower right")
    if annotation:
        ax.text(
            *annotation_xy,
            annotation,
            transform=ax.transAxes,
            fontsize=9,
            va="top",
            ha="left",
        )
    return ax


# ---------------------------------------------------------------------------
# 4. Example / demo — run this file directly to regenerate the figures.
# ---------------------------------------------------------------------------


def _demo() -> None:
    rng = np.random.default_rng(42)

    # ---- Panel (B): boxplot with points + a significance bar ----
    box_data = [
        rng.normal(82, 6, 12),
        rng.normal(74, 7, 12),
        rng.normal(60, 9, 12),
    ]
    box_labels = ["Fresh", "Cryopreserved", "Long-term storage"]

    fig_b, ax_b = plt.subplots(figsize=(3.2, 3.0))
    boxplot_with_points(
        ax_b,
        box_data,
        box_labels,
        ylabel="% Cell Recovery",
        rotate_xticks=45,
        sig=[(0, 2, "***")],
    )
    add_panel_label(ax_b, "(B)")
    save_figure(fig_b, "fig_panel_B_boxplot")

    # ---- Panel (C): bar plot with error bars + dots, fixed 0–150 y-range ----
    bar_data = [rng.normal(m, 12, 4) for m in (120, 95, 70, 110, 60, 130)]
    well_ids = [f"A{i}" for i in range(1, 7)]

    fig_c, ax_c = plt.subplots(figsize=(3.4, 3.0))
    barplot_with_points(
        ax_c,
        bar_data,
        well_ids,
        err="sem",
        ylabel="Viability (%)",
        ylim=(0, 150),
        rotate_xticks=90,
    )
    add_panel_label(ax_c, "(C)")
    save_figure(fig_c, "fig_panel_C_barplot")

    # ---- Panel (E): line plot, two groups, with an in-plot annotation ----
    x = [0, 24, 48, 72, 96]
    groups = {
        "Control": {
            "y": [10, 18, 33, 55, 80],
            "err": [1.5, 2, 2.5, 3, 3.5],
        },
        "Treated": {
            "y": [10, 15, 24, 38, 54],
            "err": [1.4, 1.8, 2.2, 2.6, 3.0],
        },
    }

    fig_e, ax_e = plt.subplots(figsize=(3.4, 3.0))
    lineplot_with_error(
        ax_e,
        x,
        groups,
        xlabel="Time (h)",
        ylabel="Cell count (×10³)",
        annotation="Doubling time:\n  Control 19 h\n  Treated 28 h",
    )
    add_panel_label(ax_e, "(E)")
    save_figure(fig_e, "fig_panel_E_lineplot")

    print("Saved fig_panel_{B,C,E}_*.{pdf,svg,png} at 600 dpi.")


if __name__ == "__main__":
    _demo()
