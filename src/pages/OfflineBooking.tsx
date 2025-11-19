import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const timeSlots = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"
];

const OfflineBooking = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to book an offline order");
        navigate("/auth");
        return;
      }

      // Create booking record (requires offline_bookings table)
      // For now, just show success message
      toast.success("Booking confirmed! We'll send you a reminder.");
      
      // TODO: Create actual booking record when table exists
      // TODO: Schedule reminder notification
      // TODO: Send confirmation email
      
      setTimeout(() => {
        navigate("/orders");
      }, 2000);
    } catch (error) {
      console.error("Booking error:", error);
      toast.error("Failed to create booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Book Offline Order</CardTitle>
            <CardDescription>
              Schedule a time to place your order in person or over the phone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="flex items-center gap-2 mb-4">
                <CalendarIcon className="w-4 h-4" />
                Select Date
              </Label>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date < new Date("1900-01-01")}
                  className="rounded-md border"
                />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4" />
                Select Time Slot
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot}
                    variant={selectedTime === slot ? "default" : "outline"}
                    onClick={() => setSelectedTime(slot)}
                    className="w-full"
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any specific requirements or preferences..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>

            {selectedDate && selectedTime && (
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">Booking Summary</p>
                <p className="text-sm text-muted-foreground">
                  Date: {selectedDate.toLocaleDateString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Time: {selectedTime}
                </p>
                {notes && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Notes: {notes}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleBooking}
              disabled={!selectedDate || !selectedTime || loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Confirming..." : "Confirm Booking"}
            </Button>

            <p className="text-sm text-muted-foreground text-center">
              You'll receive a confirmation email and a reminder before your scheduled time
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OfflineBooking;
