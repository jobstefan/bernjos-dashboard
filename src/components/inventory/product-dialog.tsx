"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createProductAction,
  updateProductAction,
} from "@/app/actions/inventory-catalog.actions";
import type { CategoryRow, ProductRow } from "@/lib/types/inventory";

type ProductType = "sale" | "production";

export function ProductDialog({
  product,
  categories,
  open,
  onOpenChange,
}: {
  product?: ProductRow | null;
  categories: CategoryRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [type, setType] = React.useState<ProductType>("sale");
  const [categoryId, setCategoryId] = React.useState("");
  const [price, setPrice] = React.useState("");
  const isEdit = Boolean(product);

  React.useEffect(() => {
    if (open) {
      setName(product?.name ?? "");
      setUnit(product?.unit ?? "");
      setType(product?.type ?? "sale");
      setCategoryId(product?.categoryId ?? categories[0]?.id ?? "");
      setPrice(product?.price != null ? String(product.price) : "");
      setErrors({});
      setFormError(null);
    }
  }, [open, product, categories]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = {
      name,
      unit,
      type,
      categoryId,
      price: type === "sale" ? (price === "" ? null : Number(price)) : null,
    };
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = product
        ? await updateProductAction({ id: product.id, ...input })
        : await createProductAction(input);
      if (res.success) {
        toast.success(isEdit ? "Product updated." : "Product created.");
        onOpenChange(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>
              Products are global — the same catalog and prices at every branch.
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pandesal"
              />
              {errors.name?.length ? (
                <p className="text-xs text-destructive">{errors.name[0]}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={(v) => setType((v as ProductType) ?? "sale")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{type === "sale" ? "Sale item" : "Production item"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Sale item</SelectItem>
                    <SelectItem value="production">Production item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Input
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="pc, loaf, bag"
                />
                {errors.unit?.length ? (
                  <p className="text-xs text-destructive">{errors.unit[0]}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {categories.find((c) => c.id === categoryId)?.name ?? "Pick a category"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId?.length ? (
                <p className="text-xs text-destructive">{errors.categoryId[0]}</p>
              ) : null}
            </div>

            {type === "sale" ? (
              <div className="grid gap-2">
                <Label>Selling price (₱)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Used only for estimated-revenue reporting — not a POS price.
                </p>
                {errors.price?.length ? (
                  <p className="text-xs text-destructive">{errors.price[0]}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Production items have no selling price — their usage is reported as quantity
                consumed, not sold.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Self-contained "New Product" button. Disabled until at least one category exists. */
export function NewProductButton({ categories }: { categories: CategoryRow[] }) {
  const [open, setOpen] = React.useState(false);
  const disabled = categories.length === 0;
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "Add a category first" : undefined}>
        <Plus className="size-4" /> New Product
      </Button>
      <ProductDialog categories={categories} open={open} onOpenChange={setOpen} />
    </>
  );
}
