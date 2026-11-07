package com.mindflow.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "monitor_session")
public class MonitorSession {

    @Id
    @Column(name = "id", length = 36, nullable = false, updatable = false)
    private String id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @Column(name = "baseline_yaw")
    private Double baselineYaw;

    @Column(name = "baseline_pitch")
    private Double baselinePitch;

    @Column(name = "baseline_roll")
    private Double baselineRoll;

    @Column(name = "focus_ratio")
    private Double focusRatio;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public void setEndedAt(Instant endedAt) {
        this.endedAt = endedAt;
    }

    public Double getBaselineYaw() {
        return baselineYaw;
    }

    public void setBaselineYaw(Double baselineYaw) {
        this.baselineYaw = baselineYaw;
    }

    public Double getBaselinePitch() {
        return baselinePitch;
    }

    public void setBaselinePitch(Double baselinePitch) {
        this.baselinePitch = baselinePitch;
    }

    public Double getBaselineRoll() {
        return baselineRoll;
    }

    public void setBaselineRoll(Double baselineRoll) {
        this.baselineRoll = baselineRoll;
    }

    public Double getFocusRatio() {
        return focusRatio;
    }

    public void setFocusRatio(Double focusRatio) {
        this.focusRatio = focusRatio;
    }

    public boolean hasBaseline() {
        return baselineYaw != null && baselinePitch != null && baselineRoll != null;
    }

    public boolean isClosed() {
        return endedAt != null;
    }
}