import { CreditCard, Smartphone, Wallet } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";

interface PaymentMethodSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const PaymentMethodSelector = ({ value, onChange }: PaymentMethodSelectorProps) => {
  const paymentMethods = [
    {
      id: "cod",
      label: "Cash on Delivery",
      description: "Pay when you receive",
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      id: "payu",
      label: "Pay Online (PayU)",
      description: "Pay securely with PayU payment gateway",
      icon: <CreditCard className="w-5 h-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Payment Method</Label>
      <RadioGroup value={value} onValueChange={onChange}>
        {paymentMethods.map((method) => (
          <Card
            key={method.id}
            className={`p-4 cursor-pointer transition-colors ${
              value === method.id ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => onChange(method.id)}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {method.icon}
                  <Label
                    htmlFor={method.id}
                    className="font-semibold cursor-pointer"
                  >
                    {method.label}
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {method.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </RadioGroup>
    </div>
  );
};

export default PaymentMethodSelector;
