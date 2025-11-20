import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModerationAuditLogEntry, ModerationActionType } from "@/types/moderation";
import { FileText, User, Clock, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AuditLogViewer() {
  const [auditLog, setAuditLog] = useState<ModerationAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchReviewId, setSearchReviewId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    fetchAuditLog();
  }, []);

  const fetchAuditLog = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      const queryParams = new URLSearchParams();
      if (searchReviewId) queryParams.append("reviewId", searchReviewId);
      if (dateFrom) queryParams.append("dateFrom", dateFrom);
      if (dateTo) queryParams.append("dateTo", dateTo);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-audit-log?${queryParams}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch audit log");

      const result = await response.json();
      setAuditLog(result.auditLog || []);
    } catch (error: any) {
      console.error("Error fetching audit log:", error);
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (actionType: ModerationActionType) => {
    const variants: Record<ModerationActionType, any> = {
      approve: { variant: "default", className: "bg-green-100 text-green-800" },
      reject: { variant: "default", className: "bg-red-100 text-red-800" },
      edit: { variant: "default", className: "bg-blue-100 text-blue-800" },
      escalate: { variant: "default", className: "bg-purple-100 text-purple-800" },
      flag: { variant: "default", className: "bg-orange-100 text-orange-800" },
      unflag: { variant: "default", className: "bg-gray-100 text-gray-800" },
    };

    return (
      <Badge {...(variants[actionType] || {})}>
        {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audit Log Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Review ID</Label>
              <Input
                placeholder="Enter review ID..."
                value={searchReviewId}
                onChange={(e) => setSearchReviewId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={fetchAuditLog} className="mt-4" disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading audit log...
            </div>
          ) : auditLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit log entries found
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Review ID</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((entry) => (
                    <TableRow key={entry.log_id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4" />
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>{getActionBadge(entry.action_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">{entry.actor_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {entry.actor_role}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.review_id.substring(0, 8)}...
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm truncate">{entry.action_summary}</p>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {entry.reason && (
                          <p className="text-sm text-muted-foreground truncate">
                            {entry.reason}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
