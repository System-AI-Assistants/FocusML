import pandas as pd
df = pd.read_excel('Taweelah -WaterLoggers2025.xlsx')

print(df["Temp"].max(),"\n\n\n")
print(df["Temp"].mean(),"\n\n\n")
print(df.groupby(df["CollectedDateAt"].dt.date)["Temp"].mean(),"\n\n\n")
print(df["Salinity"].min(),"\n\n\n")