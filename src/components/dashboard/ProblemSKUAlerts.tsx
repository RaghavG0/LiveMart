import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Bell, BellOff, CheckCircle, Settings, X } from "lucide-react";
import { toast } from "sonner";

interface Alert {
  id: string;
  product_id: string;
  alert_type: string;
  threshold_value: number;
  current_value: number;
  affected_retailers_count: number;
  alert_status: "active" | "acknowledged" | "resolved" | "dismissed";
  alert_message: string;
  created_at: string;
  product_name?: string;
  product_image_url?: string;
}

interface AlertConfig {
  min_rating_threshold: number;
  negative_review_spike_threshold: number;
  spike_time_window_days: number;
  complaint_threshold: number;
  email_notifications_enabled: boolean;
  notification_email?: string;
}

interface ProblemSKUAlertsProps {
  wholesalerId: string;
}

export default function ProblemSKUAlerts({ wholesalerId }: ProblemSKUAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [config, setConfig] = useState<AlertConfig>({
    min_rating_threshold: 3.0,
    negative_review_spike_threshold: 5,
    spike_time_window_days: 7,
    complaint_threshold: 3,
    email_notifications_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    fetchAlerts();
    fetchConfig();
  }, [wholesalerId]);

  const fetchAlerts = async () => {
    try {
      // Fetch active alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from("sku_performance_alerts" as any)
        .select("*")
        .eq("wholesaler_id", wholesalerId)
        .in("alert_status", ["active", "acknowledged"])
        .order("created_at", { ascending: false });

      if (alertsError) throw alertsError;

      // Fetch product details for alerts
      if (alertsData && alertsData.length > 0) {
        const productIds = alertsData.map((alert: any) => alert.product_id);
        const { data: products, error: productsError } = await supabase
          .from("products")
          .select("id, name, image_url")
          .in("id", productIds);

        if (productsError) throw productsError;

        const enrichedAlerts = alertsData.map((alert: any) => {
          const product = products?.find((p) => p.id === alert.product_id);
          return {
            ...alert,
            product_name: product?.name,
            product_image_url: product?.image_url,
          };
        });

        setAlerts(enrichedAlerts as any);
      } else {
        setAlerts([]);
      }
    } catch (error: any) {
      console.error("Error fetching alerts:", error);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
    const { data, error } = await supabase
      .from("wholesaler_alert_config" as any)
        .select("*")
        .eq("wholesaler_id", wholesalerId)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setConfig(data as any);
      }
    } catch (error: any) {
      console.error("Error fetching config:", error);
    }
  };

  const updateAlertStatus = async (alertId: string, newStatus: "acknowledged" | "resolved" | "dismissed") => {
    try {
      const updateData: any = { alert_status: newStatus };
      
      if (newStatus === "acknowledged" && alerts.find(a => a.id === alertId)?.alert_status === "active") {
        updateData.acknowledged_at = new Date().toISOString();
      } else if (newStatus === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("sku_performance_alerts" as any)
        .update(updateData as any)
        .eq("id", alertId);

      if (error) throw error;

      toast.success(`Alert ${newStatus}`);
      fetchAlerts();
    } catch (error: any) {
      console.error("Error updating alert:", error);
      toast.error("Failed to update alert status");
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from("wholesaler_alert_config" as any)
        .upsert({
          wholesaler_id: wholesalerId,
          ...config,
          updated_at: new Date().toISOString(),
        } as any);

      if (error) throw error;

      toast.success("Alert configuration saved");
      setShowConfigDialog(false);

      // Trigger alert check after config change
      await supabase.rpc("check_sku_performance" as any);
    } catch (error: any) {
      console.error("Error saving config:", error);
      toast.error("Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  const getAlertTypeLabel = (type: string) => {
    switch (type) {
      case "low_rating":
        return "Low Rating";
      case "negative_spike":
        return "Negative Review Spike";
      case "complaint_threshold":
        return "High Complaint Count";
      default:
        return type;
    }
  };

  const getAlertSeverity = (alert: Alert) => {
    if (alert.alert_type === "low_rating" && alert.current_value < 2.5) {
      return "critical";
    }
    if (alert.alert_type === "negative_spike" && alert.current_value >= 10) {
      return "critical";
    }
    return "warning";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Problem SKU Alerts</h2>
          <p className="text-muted-foreground">
            Monitor products that need your attention
          </p>
        </div>
        <Button onClick={() => setShowConfigDialog(true)} variant="outline">
          <Settings className="h-4 w-4 mr-2" />
          Configure Thresholds
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter((a) => a.alert_status === "active").length}
            </div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <CheckCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {alerts.filter((a) => a.alert_status === "acknowledged").length}
            </div>
            <p className="text-xs text-muted-foreground">Being addressed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Alerts</CardTitle>
            {config.email_notifications_enabled ? (
              <Bell className="h-4 w-4 text-green-500" />
            ) : (
              <BellOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {config.email_notifications_enabled ? "On" : "Off"}
            </div>
            <p className="text-xs text-muted-foreground">
              {config.notification_email || "No email configured"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Current Alerts</CardTitle>
          <CardDescription>Products that have triggered alert thresholds</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading alerts...</div>
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-semibold">All Clear!</p>
              <p className="text-muted-foreground">
                No products currently triggering alert thresholds
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {alerts.map((alert) => {
                const severity = getAlertSeverity(alert);
                return (
                  <div
                    key={alert.id}
                    className={`p-4 border rounded-lg ${
                      severity === "critical"
                        ? "border-red-300 bg-red-50"
                        : "border-yellow-300 bg-yellow-50"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        {alert.product_image_url ? (
                          <img
                            src={alert.product_image_url}
                            alt={alert.product_name}
                            className="h-16 w-16 object-cover rounded-md"
                          />
                        ) : (
                          <div className="h-16 w-16 bg-muted rounded-md flex items-center justify-center">
                            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Alert Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-semibold text-base">{alert.product_name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                variant={severity === "critical" ? "destructive" : "outline"}
                                className={severity === "critical" ? "" : "border-yellow-500 text-yellow-700"}
                              >
                                {getAlertTypeLabel(alert.alert_type)}
                              </Badge>
                              <Badge variant="outline">{alert.alert_status}</Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {alert.alert_status === "active" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAlertStatus(alert.id, "acknowledged")}
                              >
                                Acknowledge
                              </Button>
                            )}
                            {alert.alert_status === "acknowledged" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAlertStatus(alert.id, "resolved")}
                                className="bg-green-50 hover:bg-green-100 text-green-700"
                              >
                                Resolve
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateAlertStatus(alert.id, "dismissed")}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Alert Message */}
                        <p className="mt-2 text-sm text-gray-700">{alert.alert_message}</p>

                        {/* Metrics */}
                        <div className="mt-3 flex items-center gap-6 text-sm">
                          <div>
                            <span className="text-muted-foreground">Threshold: </span>
                            <span className="font-semibold">{alert.threshold_value.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Current: </span>
                            <span className="font-semibold">{alert.current_value.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Affected Retailers: </span>
                            <span className="font-semibold">{alert.affected_retailers_count}</span>
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="mt-2 text-xs text-muted-foreground">
                          Alert created: {new Date(alert.created_at).toLocaleDateString()} at{" "}
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alert Configuration</DialogTitle>
            <DialogDescription>
              Set thresholds for when you want to be notified about product issues
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="min-rating">Minimum Rating Threshold</Label>
              <Input
                id="min-rating"
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={config.min_rating_threshold}
                onChange={(e) =>
                  setConfig({ ...config, min_rating_threshold: parseFloat(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Alert when average rating falls below this value (1.0 - 5.0)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="negative-spike">Negative Review Spike Threshold</Label>
              <Input
                id="negative-spike"
                type="number"
                min="1"
                value={config.negative_review_spike_threshold}
                onChange={(e) =>
                  setConfig({ ...config, negative_review_spike_threshold: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of 1-2 star reviews to trigger an alert
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time-window">Spike Time Window (days)</Label>
              <Input
                id="time-window"
                type="number"
                min="1"
                value={config.spike_time_window_days}
                onChange={(e) =>
                  setConfig({ ...config, spike_time_window_days: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Period to check for negative review spikes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="complaint-threshold">Complaint Threshold</Label>
              <Input
                id="complaint-threshold"
                type="number"
                min="1"
                value={config.complaint_threshold}
                onChange={(e) =>
                  setConfig({ ...config, complaint_threshold: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Number of retailer complaints before alert
              </p>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Receive alerts via email
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={config.email_notifications_enabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, email_notifications_enabled: checked })
                }
              />
            </div>

            {config.email_notifications_enabled && (
              <div className="space-y-2">
                <Label htmlFor="notification-email">Notification Email</Label>
                <Input
                  id="notification-email"
                  type="email"
                  placeholder="your@email.com"
                  value={config.notification_email || ""}
                  onChange={(e) =>
                    setConfig({ ...config, notification_email: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={saveConfig} disabled={savingConfig}>
              {savingConfig ? "Saving..." : "Save Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
