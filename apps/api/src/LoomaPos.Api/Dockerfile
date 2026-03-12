FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY NuGet.Config ./NuGet.Config
COPY Directory.Build.props ./Directory.Build.props
COPY Directory.Packages.props ./Directory.Packages.props
COPY src/LoomaPos.Domain/LoomaPos.Domain.csproj src/LoomaPos.Domain/
COPY src/LoomaPos.Application/LoomaPos.Application.csproj src/LoomaPos.Application/
COPY src/LoomaPos.Infrastructure/LoomaPos.Infrastructure.csproj src/LoomaPos.Infrastructure/
COPY src/LoomaPos.Api/LoomaPos.Api.csproj src/LoomaPos.Api/

RUN dotnet restore src/LoomaPos.Api/LoomaPos.Api.csproj

COPY src ./src
RUN dotnet publish src/LoomaPos.Api/LoomaPos.Api.csproj -c Release -o /app/out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/out .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 CMD curl --fail http://localhost:8080/health/ready || exit 1
ENTRYPOINT ["dotnet", "LoomaPos.Api.dll"]
