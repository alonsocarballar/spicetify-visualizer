# Spicetify visualizer

A high-performance, ultra-smooth physics-based audio visualizer for Spicetify. Featuring real-time physics customization, dual-color gradients, and a reactive Neon bloom effect.

---

## Features

* **Spring Physics:** Advanced inertia-based bar movement using Hooke's Law for organic, elastic animations.
* **Real-time Settings:** Adjust sensitivity, friction, tension, and bar count on the fly via a hidden UI panel.
* **Dual Color Engine:** Switch between automatic vibrant album-art extraction or custom manual gradients.
* **Neon Mode:** Toggleable bloom effect that reacts dynamically to audio intensity and volume.
* **Frame-perfect Sync:** Custom synchronization engine to eliminate stuttering and maintain perfect rhythm with the audio.

---

## Installation

1.  Open your Spicetify config directory by running `spicetify config-dir` in your terminal.
2.  Navigate to the `CustomApps` folder.
3.  Create a new folder named `visualizer`.
4.  Copy your `index.js` and `manifest.json` files into the `visualizer` folder.
5.  Add the app to your Spicetify configuration by running:
    ```bash
    spicetify config custom_apps visualizer
    ```
6.  Apply the changes:
    ```bash
    spicetify apply
    ```

---

## Configuration

To access the settings panel:
1.  Open the **visualizer** tab in the Spotify sidebar.
2.  **Hover your mouse** over the top-right corner of the visualizer area.
3.  A transparent panel will appear allowing you to tweak:
    * **Friction & Tension:** Controls how "bouncy" or "heavy" the bars feel.
    * **Delay:** Micro-adjust audio/visual sync in milliseconds (useful for Bluetooth lag).
    * **Manual Color:** Enable this to unlock two color pickers for a custom base-to-top gradient.
    * **Neon Effect:** Toggle the glow/bloom rendering on or off.

---

## Updating

1.  Navigate to your Spicetify config directory: `spicetify config-dir`.
2.  Go to `CustomApps/visualizer`.
3.  Replace the old `index.js` with the latest version.
4.  Run `spicetify apply`.

---

## Uninstallation

1.  Navigate to `CustomApps` and delete the `visualizer` folder.
2.  Remove the app from your Spicetify config:
    ```bash
    spicetify config custom_apps visualizer-
    ```
3.  Run `spicetify apply`.

---

## Troubleshooting

* **Bars are missing?** Ensure you are playing a song. If the screen is black, try running `spicetify restore backup apply`.
* **UI not appearing?** The settings panel is hidden to keep the look clean. Move your cursor to the **extreme top-right corner**.
* **Colors won't change?** Toggle "Manual Color" on and then off again to force a fresh extraction of the album art colors.
