// Orbit camera for Solmar: a target point on the ground, a yaw around it,
// a pitch above the horizon and a distance. WASD slides the target across
// the streets, dragging orbits, the wheel zooms.
export function createCamera() {
  const cam = {
    target: [0, 10, 0],
    yaw: 0.7,
    pitch: 0.34,
    dist: 110,
    eye() {
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      return [
        this.target[0] + Math.sin(this.yaw) * cp * this.dist,
        this.target[1] + sp * this.dist,
        this.target[2] + Math.cos(this.yaw) * cp * this.dist,
      ];
    },
    forward() {
      return [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)];
    },
    right() {
      return [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
    },
    move(fwd, strafe, speed) {
      const f = this.forward();
      const r = this.right();
      this.target[0] += (f[0] * fwd + r[0] * strafe) * speed;
      this.target[2] += (f[2] * fwd + r[2] * strafe) * speed;
      this.target[0] = Math.max(-1900, Math.min(1900, this.target[0]));
      this.target[2] = Math.max(-1700, Math.min(1700, this.target[2]));
      this.target[1] = 10;
    },
    orbit(dx, dy) {
      this.yaw -= dx * 0.005;
      this.pitch = Math.max(0.06, Math.min(1.2, this.pitch + dy * 0.004));
    },
    zoom(delta) {
      this.dist = Math.max(18, Math.min(600, this.dist * (1 + delta * 0.001)));
    },
    // Place the camera exactly: used by the ?cam= URL parameter and the
    // screenshot shots so a view can be reproduced.
    place(eye, target) {
      this.target = [...target];
      const dx = eye[0] - target[0];
      const dy = eye[1] - target[1];
      const dz = eye[2] - target[2];
      this.dist = Math.hypot(dx, dy, dz);
      this.yaw = Math.atan2(dx, dz);
      this.pitch = Math.asin(Math.max(-1, Math.min(1, dy / this.dist)));
    },
  };
  return cam;
}
